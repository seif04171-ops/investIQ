"""
Tests for the personalisation upgrade: event matching, portfolio health,
value-curve math, and route-level integration (SQLite stands in for Postgres,
Finnhub is mocked at the HTTP layer so the real parsing code runs).
"""
import os
import uuid

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["FINNHUB_API_KEY"] = "test-key"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.services.event_matching import entity_matches_company, event_matches_company
from app.services.portfolio_health import compute_health
from app.services.portfolio_service import combine_histories


@compiles(UUID, "sqlite")
def _uuid_sqlite(t, c, **kw):
    return "CHAR(36)"


@compiles(ARRAY, "sqlite")
def _array_sqlite(t, c, **kw):
    return "JSON"


# ---------------------------------------------------------------- matching
@pytest.mark.parametrize("entity,name,ticker,expected", [
    ("Apple", "APPLE INC", "AAPL", True),
    ("Apple Inc.", "Apple Inc", "AAPL", True),
    ("AAPL", "Apple Inc", "AAPL", True),
    ("Alphabet Inc. (Google)", "Alphabet Inc", "GOOGL", True),
    ("Microsoft Corporation", "MICROSOFT CORP", "MSFT", True),
    ("Tesla", "Tesla Inc", "TSLA", True),
    ("Applebee's", "APPLE INC", "AAPL", False),
    ("Pineapple Energy", "APPLE INC", "AAPL", False),
    ("A", "Agilent Technologies", "A", False),   # single-letter ticker never matches
    ("Amazon", "Apple Inc", "AAPL", False),
    ("", "Apple Inc", "AAPL", False),
])
def test_entity_matching(entity, name, ticker, expected):
    assert entity_matches_company(entity, name, ticker) is expected


def test_event_matches_any_entity():
    assert event_matches_company(["Reuters", "Nvidia", "Fed"], "NVIDIA CORP", "NVDA")
    assert not event_matches_company(["Reuters", "Fed"], "NVIDIA CORP", "NVDA")


# ------------------------------------------------------------------ health
def test_health_none_when_empty():
    assert compute_health([], 100000, 100000) is None


def test_health_single_stock_is_flagged():
    h = compute_health([{"ticker": "TSLA", "market_value": 10000, "sector": "Automobiles"}], 90000, 100000)
    keys = {f["key"]: f for f in h["factors"]}
    assert keys["diversification"]["status"] == "risk"
    assert keys["position_size"]["status"] == "risk"
    assert h["score"] < 60
    assert "isn't a prediction" in h["disclaimer"]


def test_health_balanced_scores_higher():
    sectors = ["Tech", "Health", "Energy", "Financials", "Retail", "Utilities", "Industrials", "Media"]
    holdings = [{"ticker": f"T{i}", "market_value": 5000, "sector": s} for i, s in enumerate(sectors)]
    h = compute_health(holdings, 60000, 100000)
    assert h["score"] >= 80
    assert h["grade"] == "Well balanced"


def test_health_unknown_sectors_are_excluded_not_penalised():
    holdings = [{"ticker": f"T{i}", "market_value": 5000, "sector": "Unknown"} for i in range(6)]
    h = compute_health(holdings, 70000, 100000)
    assert "sector_balance" not in {f["key"] for f in h["factors"]}
    assert 0 <= h["score"] <= 100


def test_health_all_cash_message():
    h = compute_health([{"ticker": "X", "market_value": 100, "sector": "Tech"}], 99900, 100000)
    cash = [f for f in h["factors"] if f["key"] == "cash"][0]
    assert cash["status"] == "risk"


# ------------------------------------------------------------ value curve
def test_combine_histories_sums_positions():
    pts = combine_histories(
        {"AAA": 2, "BBB": 10},
        {"AAA": [{"date": 1, "close": 10}, {"date": 2, "close": 11}],
         "BBB": [{"date": 1, "close": 1}, {"date": 2, "close": 2}]},
    )
    assert pts == [{"date": 1, "value": 30.0}, {"date": 2, "value": 42.0}]


def test_combine_histories_skips_incomplete_days_and_missing_history():
    pts = combine_histories(
        {"AAA": 1, "BBB": 1, "CCC": 5},
        {"AAA": [{"date": 1, "close": 10}, {"date": 2, "close": 12}],
         "BBB": [{"date": 2, "close": 3}],
         "CCC": []},
    )
    assert pts == [{"date": 2, "value": 15.0}]  # day 1 lacks BBB; CCC has no history so is excluded
    assert combine_histories({"X": 1}, {}) == []


# -------------------------------------------------------- route integration
@pytest.fixture()
def client(monkeypatch):
    from fastapi.testclient import TestClient
    from app.core import db as dbmod
    from app.core.db import Base, get_db
    from app.core.security import get_current_user
    from app.main import app as fastapi_app
    from app.models.news import Company, Event, EventEntity
    from app.models.user_data import User
    from app.services import market_data
    import importlib
    importlib.import_module("app.models")  # register all tables

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False)

    db = Session()
    user = User(email="t@example.com", password_hash="x", display_name="Tester")
    db.add(user)
    db.commit()
    db.refresh(user)

    def _get_db():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    fastapi_app.dependency_overrides[get_db] = _get_db
    fastapi_app.dependency_overrides[get_current_user] = lambda: user

    quotes = {"AAPL": {"c": 200.0, "d": 4.0, "dp": 2.04, "h": 201, "l": 195, "o": 196, "pc": 196.0},
              "MSFT": {"c": 400.0, "d": -2.0, "dp": -0.5, "h": 405, "l": 398, "o": 402, "pc": 402.0}}
    profiles = {"AAPL": {"name": "Apple Inc", "finnhubIndustry": "Technology"},
                "MSFT": {"name": "Microsoft Corp", "finnhubIndustry": "Technology"}}

    class FakeResp:
        def __init__(self, data, status=200):
            self._d, self.status_code = data, status
        def json(self):
            return self._d
        def raise_for_status(self):
            pass

    class FakeClient:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def get(self, url, params=None):
            sym = (params or {}).get("symbol", "")
            if url.endswith("/quote"):
                return FakeResp(quotes.get(sym, {"c": 0, "h": 0, "l": 0, "d": 0, "dp": 0}))
            if url.endswith("/search"):
                q = params["q"].upper()
                return FakeResp({"result": [{"symbol": s, "description": profiles[s]["name"].upper()} for s in profiles if s == q]})
            if url.endswith("/stock/profile2"):
                return FakeResp(profiles.get(sym, {}))
            if url.endswith("/stock/metric"):
                return FakeResp({"metric": {"peTTM": 31.2, "52WeekHigh": 210, "52WeekLow": 150}})
            if url.endswith("/stock/candle"):
                return FakeResp({"s": "ok", "t": [1, 2, 3], "c": [190, 195, quotes.get(sym, {}).get("c", 1)]})
            return FakeResp({}, 404)

    monkeypatch.setattr(market_data.httpx, "Client", FakeClient)
    market_data.clear_cache()

    # a news event that mentions Apple + one about nothing we hold
    e1 = Event(title="Apple unveils chip", summary="Apple announced...", event_type="company", credibility_score=80)
    e2 = Event(title="Oil rises", summary="Crude up", event_type="economic", credibility_score=70)
    db.add_all([e1, e2])
    db.commit()
    db.add_all([
        EventEntity(event_id=e1.id, entity_type="company", entity_value="Apple", predicted_effect="positive"),
        EventEntity(event_id=e2.id, entity_type="company", entity_value="Exxon Mobil", predicted_effect="mixed"),
    ])
    db.commit()

    yield TestClient(fastapi_app), quotes
    fastapi_app.dependency_overrides.clear()


def test_buy_uses_server_side_live_price_and_summary_is_live(client):
    c, quotes = client
    # client claims a $1 price — server must ignore it and use the live $200
    r = c.post("/portfolio/buy", json={"ticker": "AAPL", "shares": 10, "price_per_share": 1.0, "note": "I like their ecosystem"})
    assert r.status_code == 200, r.text
    assert r.json()["price"] == 200.0

    s = c.get("/portfolio/summary").json()
    h = s["holdings"][0]
    assert h["ticker"] == "AAPL" and h["price_is_live"] is True
    assert h["sector"] == "Technology"           # sector fetched on company creation
    assert s["cash_balance"] == 100000 - 2000
    assert s["prices_live"] is True
    assert s["health"] is not None
    assert {a["label"] for a in s["allocation"]} == {"Technology", "Cash"}
    assert h["gain_loss_pct"] == 0.0             # bought at live price, still at live price
    assert h["day_change_value"] == pytest.approx(40.0)


def test_gain_loss_is_real_when_price_moves(client):
    c, quotes = client
    c.post("/portfolio/buy", json={"ticker": "AAPL", "shares": 10})
    from app.services import market_data
    quotes["AAPL"] = {"c": 220.0, "d": 20.0, "dp": 10.0, "h": 221, "l": 199, "o": 200, "pc": 200.0}
    market_data.clear_cache()
    s = c.get("/portfolio/summary").json()
    assert s["holdings"][0]["gain_loss_pct"] == 10.0
    assert s["unrealized_gain_loss"] == 200.0
    assert s["total_return_value"] == 200.0


def test_buy_rejects_bad_input_and_overspend(client):
    c, _ = client
    assert c.post("/portfolio/buy", json={"ticker": "AAPL", "shares": 0}).status_code == 400
    assert c.post("/portfolio/buy", json={"ticker": "AAPL", "shares": -3}).status_code == 400
    assert c.post("/portfolio/buy", json={"ticker": "ZZZZ", "shares": 1}).status_code == 400
    r = c.post("/portfolio/buy", json={"ticker": "AAPL", "shares": 100000})
    assert r.status_code == 400 and "cash" in r.json()["detail"]


def test_sell_and_journal_since_pct(client):
    c, quotes = client
    c.post("/portfolio/buy", json={"ticker": "AAPL", "shares": 10, "note": "thesis one"})
    from app.services import market_data
    quotes["AAPL"]["c"] = 250.0
    market_data.clear_cache()
    tx = c.get("/portfolio/transactions").json()
    assert tx[0]["note"] == "thesis one"
    assert tx[0]["since_pct"] == 25.0
    assert c.post("/portfolio/sell", json={"ticker": "AAPL", "shares": 4}).status_code == 200
    assert c.post("/portfolio/sell", json={"ticker": "AAPL", "shares": 99}).status_code == 400
    s = c.get("/portfolio/summary").json()
    assert s["holdings"][0]["shares"] == 6


def test_performance_curve_and_reset(client):
    c, _ = client
    assert c.get("/portfolio/performance").json()["reason"] == "no_holdings"
    c.post("/portfolio/buy", json={"ticker": "AAPL", "shares": 10})
    p = c.get("/portfolio/performance?days=30").json()
    assert [pt["value"] for pt in p["points"]] == [1900.0, 1950.0, 2000.0]
    assert c.post("/portfolio/reset").status_code == 200
    s = c.get("/portfolio/summary").json()
    assert s["holdings"] == [] and s["cash_balance"] == 100000 and s["health"] is None


def test_briefing_matches_news_to_holdings_and_watchlist(client):
    c, _ = client
    assert c.get("/briefing").json()["tracked_count"] == 0
    c.post("/portfolio/buy", json={"ticker": "AAPL", "shares": 1})
    c.post("/watchlist", json={"ticker": "MSFT"})
    from datetime import datetime, timezone
    from app.services import news_live
    now = datetime.now(timezone.utc).isoformat()
    news_live._items[:] = [
        {"id": "x1", "title": "Apple unveils chip", "summary": "", "url": "http://x", "source": "Reuters", "published_at": now,
         "tickers": ["AAPL"], "effect": "positive", "impact": "high", "why": "w"},
        {"id": "x2", "title": "Unrelated Tesla news", "summary": "", "url": "http://y", "source": "Reuters", "published_at": now,
         "tickers": ["TSLA"], "effect": "neutral", "impact": "low", "why": "w"},
    ]
    b = c.get("/briefing").json()
    assert b["tracked_count"] == 2
    assert [e["title"] for e in b["news"]] == ["Apple unveils chip"]
    assert b["news"][0]["relation"] == "holding" and b["news"][0]["matched_tickers"] == ["AAPL"]
    assert {m["ticker"] for m in b["moves"]} == {"AAPL", "MSFT"}


def test_events_filtered_by_ticker(client):
    c, _ = client
    c.post("/watchlist", json={"ticker": "AAPL"})
    assert [e["title"] for e in c.get("/analysis/events?ticker=AAPL").json()] == ["Apple unveils chip"]
    assert c.get("/analysis/events?ticker=NOPE").json() == []
    assert len(c.get("/analysis/events").json()) == 2


def test_stock_endpoint_degrades_gracefully(client):
    c, _ = client
    s = c.get("/market/stock/AAPL").json()
    assert s["quote"]["price"] == 200.0 and s["profile"]["industry"] == "Technology"
    assert s["stats"]["pe"] == 31.2 and s["stats"]["week52_high"] == 210
    assert c.get("/market/stock/ZZZZ").status_code == 404
    q = c.get("/market/quotes?tickers=AAPL,ZZZZ").json()
    assert q["AAPL"]["price"] == 200.0 and q["ZZZZ"] is None


def test_history_falls_back_to_public_source(monkeypatch):
    from app.services import market_data as md
    md.clear_cache()
    monkeypatch.setattr(md, "_require_key", lambda: None)

    def finnhub_blocked(symbol, days):
        raise md.MarketDataUnavailable("Price history isn't available on your current Finnhub plan.")

    now = int(__import__("time").time())
    monkeypatch.setattr(md, "_history_finnhub", finnhub_blocked)
    monkeypatch.setattr(md, "_history_yahoo", lambda s, d: [{"date": now - 86400, "close": 1.0}, {"date": now, "close": 2.0}])
    assert md.get_history("AAPL", 30)[-1]["close"] == 2.0


def test_history_reports_when_all_sources_fail(monkeypatch):
    import pytest
    from app.services import market_data as md
    md.clear_cache()
    monkeypatch.setattr(md, "_require_key", lambda: None)

    def blocked(symbol, days):
        raise md.MarketDataUnavailable("nope")

    monkeypatch.setattr(md, "_history_finnhub", blocked)
    monkeypatch.setattr(md, "_history_yahoo", blocked)
    with pytest.raises(md.MarketDataUnavailable):
        md.get_history("ZZZZ", 30)


def test_intraday_parses_public_payload(monkeypatch):
    from app.services import market_data as md
    md.clear_cache()
    payload = {"chart": {"result": [{"timestamp": [1, 2, 3], "indicators": {"quote": [{"close": [10.0, None, 12.5]}]}}]}}

    class FakeResp:
        def raise_for_status(self): pass
        def json(self): return payload

    class FakeClient:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def get(self, *a, **k): return FakeResp()

    monkeypatch.setattr(md.httpx, "Client", FakeClient)
    pts = md.get_history("AAPL", 1)
    assert [p["close"] for p in pts] == [10.0, 12.5]
