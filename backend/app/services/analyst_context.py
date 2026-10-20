"""
Builds the live, factual context the AI analyst answers from: the user's
paper portfolio and watchlist, market mood, the freshest credible headlines,
the current top signals, and — for any stocks named in the question — live
price, key stats, one-month move and the news that mentions them.

Everything here is real data fetched at question time; if a source is down
the section is simply omitted (and the model is told nothing was available).
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.news import Company
from app.models.user_data import User, WatchlistItem
from app.services import news_live, opportunities, portfolio_service, research, universe
from app.services.market_data import get_market_overview, get_market_sentiment

logger = logging.getLogger(__name__)

_STOP = {
    "I", "A", "AI", "US", "USA", "ETF", "ETFS", "CEO", "CFO", "IPO", "GDP", "CPI", "FED", "EPS", "PE", "ATH",
    "IMO", "FAQ", "OK", "VS", "AND", "THE", "FOR", "ARE", "BUY", "SELL", "HOLD", "NEWS", "WHY", "HOW", "WHAT",
    "WHEN", "YOUR", "MY", "ME", "IS", "IT", "OR", "OF", "TO", "IN", "ON", "AT", "BY", "AM", "PM", "EU", "UK",
    "USD", "EUR", "YTD", "QOQ", "YOY", "TTM", "ROI", "ROE", "DCF", "SEC", "IRS", "FOMC", "OPEC", "NYSE",
}
_TICKER_RE = re.compile(r"(?<![A-Za-z0-9])\$?([A-Z]{1,5})(?![A-Za-z0-9])")
_CASHTAG_RE = re.compile(r"\$([A-Za-z]{1,5})\b")


def _user_tracked(db: Session, user: User) -> dict[str, dict]:
    tracked: dict[str, dict] = {}
    portfolio = portfolio_service.get_or_create_portfolio(db, user.id)
    for h, c in portfolio_service.list_holdings(db, portfolio):
        if c and c.ticker:
            tracked[c.ticker.upper()] = {"name": c.name, "relation": "holding"}
    for _, c in (
        db.query(WatchlistItem, Company)
        .join(Company, Company.id == WatchlistItem.company_id)
        .filter(WatchlistItem.user_id == user.id)
        .all()
    ):
        if c.ticker and c.ticker.upper() not in tracked:
            tracked[c.ticker.upper()] = {"name": c.name, "relation": "watchlist"}
    return tracked


def find_focus_tickers(question: str, tracked: dict[str, dict], limit: int = 4) -> list[str]:
    """Tickers the question is about: $CASHTAGS, ALL-CAPS symbols, or names of stocks the user tracks."""
    found: list[str] = []

    def add(t: str):
        t = t.upper()
        if t not in found:
            found.append(t)

    for m in _CASHTAGS(question):
        add(m)
    for m in _TICKER_RE.finditer(question):
        sym = m.group(1)
        if len(sym) >= 2 and sym not in _STOP:
            add(sym)
    for t in universe.find_tickers_in_text(question):   # any well-known company by name, tracked or not
        add(t)
    low = question.lower()
    for t, info in tracked.items():
        first = (info["name"] or "").lower().replace(",", " ").split()
        first = first[0] if first else ""
        if len(first) >= 4 and re.search(rf"\b{re.escape(first)}\b", low):
            add(t)
    return found[: limit + 4]  # a few extra: invalid ones are dropped after the quote check


def _CASHTAGS(text: str) -> list[str]:
    return [m.group(1) for m in _CASHTAG_RE.finditer(text)]


def _ago(dt: datetime | None, now: datetime) -> str:
    if not dt:
        return "date unknown"
    dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    h = (now - dt).total_seconds() / 3600
    return f"{max(1, int(h * 60))}m ago" if h < 1 else f"{int(h)}h ago" if h < 48 else f"{int(h // 24)}d ago"


def build_context(db: Session, user: User, question: str) -> str:
    now = datetime.now(timezone.utc)
    parts: list[str] = [f"TODAY (UTC): {now:%A %Y-%m-%d %H:%M}. All figures below are live data fetched just now."]
    tracked: dict[str, dict] = {}

    try:
        tracked = _user_tracked(db, user)
        portfolio = portfolio_service.get_or_create_portfolio(db, user.id)
        if portfolio_service.list_holdings(db, portfolio):
            s = portfolio_service.get_portfolio_summary(db, portfolio)
            rows = [
                f"{h['ticker'] or h['company']}: {h['shares']:g} sh, ${h['market_value']:,.0f} ({h['weight_pct']}% of book), "
                f"P&L {h['gain_loss_pct']:+.1f}%, today {h['day_change_pct']:+.1f}%, sector {h['sector']}"
                for h in s["holdings"][:10]
            ]
            health = s.get("health")
            parts.append(
                "USER'S PAPER PORTFOLIO (simulated money):\n- " + "\n- ".join(rows)
                + f"\nTotal ${s['total_value']:,.0f}, cash ${s['cash_balance']:,.0f}, return {s['total_return_pct']:+.2f}%."
                + (f" Health score {health['score']}/100 ({health['grade']})." if health else "")
            )
        watch = [t for t, i in tracked.items() if i["relation"] == "watchlist"]
        if watch:
            parts.append("USER'S WATCHLIST: " + ", ".join(watch))
    except Exception:
        logger.warning("analyst context: portfolio section failed", exc_info=True)

    try:
        idx = get_market_overview()
        sent = get_market_sentiment()
        parts.append(
            "MARKET: " + "; ".join(f"{i['index_name']} {i['change_percent']:+.2f}%" for i in idx)
            + f". Mood: {sent['label']} (score {sent['score']}/100)."
        )
    except Exception:
        pass

    try:
        recent = news_live.ranked(limit=10, max_age_hours=48)
        if recent:
            parts.append(
                "FRESHEST MARKET-MOVING HEADLINES (credibility /100, effect/impact):\n- "
                + "\n- ".join(
                    f"[{n['credibility']}] {n['title']} — {n['source']}, {_ago(datetime.fromisoformat(n['published_at']), now)}"
                    + (f" [{', '.join(n['tickers'][:3])}]" if n["tickers"] else "")
                    + f" ({n.get('effect', '?')}/{n.get('impact', '?')})"
                    for n in recent
                )
            )
    except Exception:
        pass

    try:
        rel = {t: {"relation": i["relation"], "name": i["name"]} for t, i in tracked.items()}
        sig = opportunities.build_opportunities(db, rel)["items"]
        if sig:
            top = sig[:4]
            bottom = [s for s in sig if s["direction"] == "bearish"][:3]
            fmt = lambda s: f"{s['ticker']} {s['score']}/100 {s['label']} ({s['confidence']} confidence)"
            parts.append("TOP SIGNALS: " + "; ".join(fmt(s) for s in top)
                         + ("\nWEAKEST: " + "; ".join(fmt(s) for s in bottom) if bottom else ""))
    except Exception:
        sig = []

    try:
        candidates = find_focus_tickers(question, tracked)
        sig_by = {x["ticker"]: x for x in sig}
        focus = 0
        for t in candidates:
            if focus >= 4:
                break
            snap = research.snapshot(t)
            if not snap.get("quote"):
                continue
            focus += 1
            text = research.snapshot_text(snap)
            if t in sig_by:
                x = sig_by[t]
                text += f"\nInvestIQ signal: {x['score']}/100 {x['label']} ({x['confidence']} confidence) — " + " ".join(x["reasons"][:2])
            parts.append("STOCK FILE\n" + text)
    except Exception:
        logger.warning("analyst context: focus section failed", exc_info=True)

    return "\n\n".join(parts)
