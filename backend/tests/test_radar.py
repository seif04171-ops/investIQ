"""Signal engine, ticker resolver, refresh runner and analyst helpers."""
import time

from app.services import opportunities as opp
from app.services import news_live, research, ticker_resolver, universe
from app.services.analyst_context import find_focus_tickers


def story(effect, cred=85, age=2.0):
    return {"id": "x", "title": "T", "effect": effect, "credibility": cred, "age_hours": age, "when": "", "analysis_score": None}


def test_news_score_directionality():
    pos = opp.news_score([story("positive")])
    neg = opp.news_score([story("negative")])
    assert pos > 65 and neg < 35
    assert opp.news_score([]) is None
    assert 45 < opp.news_score([story("mixed")]) < 55


def test_stale_and_low_credibility_news_counts_less():
    fresh = opp.news_score([story("positive", cred=90, age=1)])
    stale = opp.news_score([story("positive", cred=90, age=72)])
    shaky = opp.news_score([story("positive", cred=20, age=1)])
    assert fresh > stale and fresh > shaky


def test_more_confirming_stories_raise_score():
    one = opp.news_score([story("positive")])
    three = opp.news_score([story("positive")] * 3)
    assert three > one


def test_momentum_and_range():
    assert opp.momentum_score(10, 2) > 70
    assert opp.momentum_score(-10, -2) < 30
    assert opp.momentum_score(None, None) is None
    assert opp.range_position(150, 100, 200) == 0.5
    assert opp.range_position(150, 200, 100) is None
    assert opp.range_position(250, 100, 200) == 1.0


def test_combine_reweights_missing_components():
    full = opp.combine({"news": 80, "momentum": 60, "trend": 40})
    assert round(full, 2) == round((80 * 0.45 + 60 * 0.25 + 40 * 0.10) / 0.80, 2)
    assert opp.combine({"news": None, "momentum": 60, "trend": None}) == 60
    assert opp.combine({"news": None, "momentum": None, "trend": None}) is None


def test_labels_and_confidence():
    assert opp.label_for(80) == ("Strong bullish signals", "bullish")
    assert opp.label_for(60)[1] == "bullish"
    assert opp.label_for(50)[1] == "neutral"
    assert opp.label_for(38) == ("Leaning bearish", "bearish")
    assert opp.label_for(10)[1] == "bearish"
    assert opp.confidence_for([story("positive", 85), story("positive", 80)], True) == "High"
    assert opp.confidence_for([story("positive", 85)], True) == "Medium"
    assert opp.confidence_for([], True) == "Low"


def test_explanations_use_real_facts_and_flag_risks():
    stories = [story("positive", 90, 3), story("negative", 70, 10)]
    reasons, risks = opp.explain(stories, 22.0, 1.5, 0.95, "bullish")
    text = " ".join(reasons)
    assert "2 stories" in text and "22.0%" in text and "95%" in text
    joined = " ".join(risks)
    assert "other way" in joined and "priced in" in joined and "52-week high" in joined
    _, risks_single = opp.explain([story("positive")], None, None, None, "bullish")
    assert any("single story" in r for r in risks_single)


def test_ticker_resolver_accepts_only_matching_names(monkeypatch):
    ticker_resolver.clear_cache()
    results = [
        {"symbol": "APLE", "description": "APPLE HOSPITALITY REIT INC", "type": "Common Stock"},
        {"symbol": "AAPL.MX", "description": "APPLE INC", "type": "Common Stock"},
        {"symbol": "AAPL", "description": "APPLE INC", "type": "Common Stock"},
    ]
    monkeypatch.setattr(ticker_resolver.market_data, "search_symbol", lambda q: results)
    assert ticker_resolver.resolve_network("Apple Inc")["ticker"] == "AAPL"
    ticker_resolver.clear_cache()
    monkeypatch.setattr(ticker_resolver.market_data, "search_symbol", lambda q: [results[0]])
    assert ticker_resolver.resolve_network("Federal Reserve") is None
    assert ticker_resolver.pretty_name("BOEING CO/THE") == "Boeing Co"


def test_focus_ticker_detection():
    tracked = {"AAPL": {"name": "Apple Inc", "relation": "holding"}}
    assert "NVDA" in find_focus_tickers("Is $NVDA a good setup?", tracked)
    assert "AAPL" in find_focus_tickers("how is apple doing", tracked)
    got = find_focus_tickers("Why did the CEO say AI and GDP matter?", tracked)
    assert "CEO" not in got and "GDP" not in got and "AI" not in got


def _iso(hours_ago):
    from datetime import datetime, timedelta, timezone
    return (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).isoformat()


def _news(id_, title, tickers, effect, impact="high", source="Reuters", hours=2):
    return {"id": id_, "title": title, "summary": "", "url": "http://x/" + id_, "source": source,
            "published_at": _iso(hours), "tickers": tickers, "effect": effect, "impact": impact, "why": "because",
            "annotated_by": "claude"}


def _wait_news():
    for _ in range(100):
        if not news_live.status()["running"]:
            break
        time.sleep(0.05)


def test_live_refresh_fetches_merges_and_reports(monkeypatch, tmp_path):
    monkeypatch.setattr(news_live, "CACHE_FILE", tmp_path / "n.json")
    monkeypatch.setattr(news_live.settings, "ANTHROPIC_API_KEY", "")
    fresh = news_live._item("Nvidia stock jumps after earnings beat", "http://a", "Reuters",
                            __import__("datetime").datetime.now(__import__("datetime").timezone.utc))
    monkeypatch.setattr(news_live, "fetch_all", lambda tickers: ([fresh, dict(fresh)], {"yahoo": {"ok": 1, "failed": 0, "error": None}}))
    news_live._items[:] = []
    news_live._state.update(running=False, finished_at=None, error=None)
    assert news_live.start_refresh(force=True)["started"] is True
    _wait_news()
    st = news_live.status()
    assert st["error"] is None and st["item_count"] == 1 and st["annotated_by"] == "heuristic"
    item = news_live.get_items()[0]
    assert item["tickers"] == ["NVDA"] and item["effect"] == "positive"
    assert news_live.start_refresh()["started"] is False       # inside the minimum gap
    assert (tmp_path / "n.json").exists()


def test_live_refresh_surfaces_total_failure(monkeypatch, tmp_path):
    monkeypatch.setattr(news_live, "CACHE_FILE", tmp_path / "n.json")
    monkeypatch.setattr(news_live, "fetch_all", lambda t: ([], {"finnhub": {"ok": 0, "failed": 3, "error": "HTTPStatusError: 401"}}))
    news_live._items[:] = []
    news_live._state.update(running=False, finished_at=None, error=None)
    news_live.start_refresh(force=True)
    _wait_news()
    assert "401" in (news_live.status()["error"] or "")


def test_merge_drops_old_and_dedupes():
    old = _news("a", "Old story", ["AAPL"], "neutral", hours=24 * 9)
    new = _news("b", "New story", ["AAPL"], "positive")
    again = dict(new, tickers=["MSFT"])
    merged = news_live.merge([old, new], [again])
    assert [i["id"] for i in merged] == ["b"] and set(merged[0]["tickers"]) == {"AAPL", "MSFT"}


def test_universe_tags_headlines_without_false_positives():
    assert universe.find_tickers_in_text("Nvidia and Apple Inc rally; (NASDAQ: AMD) up") == ["AMD", "AAPL", "NVDA"]
    assert universe.find_tickers_in_text("The cat sat on a visa application for the ups and downs") == []
    assert "META" in universe.find_tickers_in_text("Meta Platforms unveils new glasses")


def test_yahoo_rss_parsing():
    xml = ("<rss><channel><item><title>Tesla recalls cars</title><link>http://t</link>"
           "<pubDate>Tue, 20 Oct 2026 20:00:00 +0000</pubDate><source>Reuters</source></item>"
           "<item><title>No date</title><link>http://u</link></item></channel></rss>")
    rows = news_live.parse_yahoo_rss(xml, "TSLA")
    assert len(rows) == 1 and rows[0]["tickers"] == ["TSLA"] and rows[0]["source"] == "Reuters"
    assert news_live.parse_yahoo_rss("not xml") == []


def test_ranked_prefers_high_impact_fresh_credible():
    news_live._items[:] = [
        _news("1", "Fluff piece", ["AAPL"], "neutral", impact="low", source="Motley Fool", hours=1),
        _news("2", "Apple earnings beat", ["AAPL"], "positive", impact="high", source="Reuters", hours=3),
    ]
    assert news_live.ranked(limit=2)[0]["id"] == "2"


def test_technicals_and_scores():
    up = [100 + i for i in range(60)]
    t = research.technicals(up)
    assert t["trend"] == "uptrend" and t["rsi14"] == 100.0 and t["ret_1m"] > 0
    assert research.rsi([1.0] * 3) is None
    assert research.technical_score(160, t) > 50
    down = [200 - i for i in range(60)]
    assert research.technical_score(141, research.technicals(down)) < 50


# ------------------------------------------------- end-to-end signal build
def _db_session():
    import os
    os.environ.setdefault("DATABASE_URL", "sqlite://")
    import importlib
    from sqlalchemy import create_engine
    from sqlalchemy.dialects.postgresql import ARRAY, UUID
    from sqlalchemy.ext.compiler import compiles
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool
    from app.core.db import Base

    compiles(UUID, "sqlite")(lambda t, c, **kw: "CHAR(36)")
    compiles(ARRAY, "sqlite")(lambda t, c, **kw: "JSON")
    importlib.import_module("app.models")
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False)()


def test_build_opportunities_scans_whole_universe(monkeypatch):
    news_live._items[:] = [
        _news("n1", "Nvidia beats estimates", ["NVDA"], "positive"),
        _news("n2", "Boeing halts deliveries", ["BA"], "negative", hours=3),
    ]
    opp.clear_cache()
    monkeypatch.setattr(opp, "get_quotes_bulk", lambda ts: {t: {"price": 100.0, "change_percent": 1.0 if t == "NVDA" else -2.0} for t in ts})
    monkeypatch.setattr(opp, "get_history", lambda t, d: [{"date": i, "close": (80.0 if t == "NVDA" else 120.0) + i} for i in range(60)])
    monkeypatch.setattr(opp, "get_basic_metrics", lambda t: {"week52_low": 60.0, "week52_high": 110.0})

    result = opp.build_opportunities(None, {"ZZZZ": {"relation": "watchlist", "name": "Custom Co"}})
    by = {i["ticker"]: i for i in result["items"]}
    assert by["NVDA"]["score"] > by["BA"]["score"]
    assert by["NVDA"]["direction"] == "bullish" and by["BA"]["direction"] != "bullish"
    assert by["NVDA"]["stories"][0]["title"] == "Nvidia beats estimates"
    assert by["ZZZZ"]["relation"] == "watchlist" and by["ZZZZ"]["story_count"] == 0
    assert any("No recent news" in r for r in by["ZZZZ"]["risks"])
    assert len(by) >= 14                                # padded with popular names, never an empty radar
    assert "not predictions" in result["disclaimer"]
