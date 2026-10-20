"""
Per-stock research: price action, technicals, analyst consensus, next earnings,
fundamentals and linked news — everything the stock page and the AI analyst
need, for ANY ticker (not only the user's watchlist). Every field is optional:
whatever a data source can't provide is simply left out, never invented.
"""
from __future__ import annotations

import threading
import time
from datetime import datetime, timedelta, timezone

import httpx

from app.core.config import settings
from app.services import news_live, universe
from app.services.market_data import (
    FINNHUB_BASE, get_basic_metrics, get_company_profile, get_history, get_quote, normalize_quote,
)

CACHE_TTL = 120
_cache: dict[str, tuple[float, dict]] = {}
_lock = threading.Lock()


# ------------------------------------------------------------- pure maths

def sma(values: list[float], n: int) -> float | None:
    return sum(values[-n:]) / n if len(values) >= n else None


def rsi(values: list[float], n: int = 14) -> float | None:
    if len(values) < n + 1:
        return None
    gains = losses = 0.0
    for a, b in zip(values[-n - 1:-1], values[-n:]):
        d = b - a
        gains += max(d, 0)
        losses += max(-d, 0)
    if losses == 0:
        return 100.0 if gains else 50.0
    rs = (gains / n) / (losses / n)
    return 100 - 100 / (1 + rs)


def pct_return(values: list[float], bars: int) -> float | None:
    if len(values) <= bars or not values[-bars - 1]:
        return None
    return (values[-1] / values[-bars - 1] - 1) * 100


def technicals(closes: list[float]) -> dict:
    if len(closes) < 5:
        return {}
    last = closes[-1]
    s20, s50 = sma(closes, 20), sma(closes, 50)
    out = {
        "last": last, "sma20": s20, "sma50": s50, "rsi14": rsi(closes),
        "ret_1w": pct_return(closes, 5), "ret_1m": pct_return(closes, 21), "ret_3m": pct_return(closes, 63),
    }
    if s20 and s50:
        out["trend"] = "uptrend" if last > s20 > s50 else "downtrend" if last < s20 < s50 else "sideways"
    elif s20:
        out["trend"] = "above its 20-day average" if last > s20 else "below its 20-day average"
    return {k: (round(v, 2) if isinstance(v, float) else v) for k, v in out.items() if v is not None}


def technical_score(price: float | None, t: dict) -> float | None:
    """50 = neutral. Price vs its 50-day average, nudged by RSI extremes."""
    import math
    base = t.get("sma50") or t.get("sma20")
    if not price or not base:
        return None
    score = 50 + 50 * math.tanh(((price / base - 1) * 100) / 8.0)
    r = t.get("rsi14")
    if r is not None:
        if r >= 75:
            score -= 8   # stretched: pullbacks are common
        elif r <= 25:
            score += 6   # washed out: bounces are common
    return max(0.0, min(100.0, score))


# ------------------------------------------------------------- Finnhub extras

def get_consensus(ticker: str) -> dict | None:
    if not settings.FINNHUB_API_KEY:
        return None
    try:
        with httpx.Client(timeout=10.0) as c:
            r = c.get(f"{FINNHUB_BASE}/stock/recommendation", params={"symbol": ticker, "token": settings.FINNHUB_API_KEY})
            r.raise_for_status()
            rows = r.json()
        if not rows:
            return None
        latest = rows[0]
        sb, b, h, s, ss = (latest.get(k, 0) or 0 for k in ("strongBuy", "buy", "hold", "sell", "strongSell"))
        total = sb + b + h + s + ss
        if not total:
            return None
        bull = (sb + b) / total
        bear = (s + ss) / total
        view = "Mostly Buy" if bull >= 0.6 else "Mostly Sell" if bear >= 0.4 else "Mixed / Hold"
        return {"strong_buy": sb, "buy": b, "hold": h, "sell": s, "strong_sell": ss, "analysts": total,
                "period": latest.get("period"), "view": view}
    except Exception:
        return None


def get_next_earnings(ticker: str) -> str | None:
    if not settings.FINNHUB_API_KEY:
        return None
    try:
        today = datetime.now(timezone.utc).date()
        with httpx.Client(timeout=10.0) as c:
            r = c.get(f"{FINNHUB_BASE}/calendar/earnings", params={
                "symbol": ticker, "from": today.isoformat(), "to": (today + timedelta(days=120)).isoformat(),
                "token": settings.FINNHUB_API_KEY,
            })
            r.raise_for_status()
            rows = r.json().get("earningsCalendar") or []
        dates = sorted(x["date"] for x in rows if x.get("date"))
        return dates[0] if dates else None
    except Exception:
        return None


# ------------------------------------------------------------------ snapshot

def snapshot(ticker: str, with_news: bool = True) -> dict:
    sym = ticker.upper().strip()
    with _lock:
        hit = _cache.get(sym)
    if hit and time.time() - hit[0] < CACHE_TTL:
        out = dict(hit[1])
        if with_news:
            out["news"] = news_live.ranked(limit=8, ticker=sym)
        return out

    out: dict = {"ticker": sym, "name": universe.name_for(sym)}
    stock = universe.BY_TICKER.get(sym)
    if stock:
        out["sector"], out["category"] = stock.sector, stock.category
    try:
        out["quote"] = normalize_quote(get_quote(sym))
    except Exception:
        out["quote"] = None
    try:
        p = get_company_profile(sym)
        out["profile"] = p
        if p.get("name"):
            out["name"] = p["name"]
    except Exception:
        pass
    try:
        out["metrics"] = get_basic_metrics(sym)
    except Exception:
        out["metrics"] = {}
    try:
        closes = [p["close"] for p in get_history(sym, 120)]
        out["technicals"] = technicals(closes)
    except Exception:
        out["technicals"] = {}
    out["consensus"] = get_consensus(sym)
    out["next_earnings"] = get_next_earnings(sym)
    with _lock:
        _cache[sym] = (time.time(), {k: v for k, v in out.items() if k != "news"})
    if with_news:
        out["news"] = news_live.ranked(limit=8, ticker=sym)
    return out


def clear_cache() -> None:
    with _lock:
        _cache.clear()


def snapshot_text(snap: dict) -> str:
    """Compact fact sheet for the AI analyst."""
    q, t, m, c = snap.get("quote") or {}, snap.get("technicals") or {}, snap.get("metrics") or {}, snap.get("consensus")
    lines = [f"{snap['ticker']} — {snap.get('name')}" + (f" ({snap['sector']})" if snap.get("sector") else "")]
    if q.get("price") is not None:
        lines.append(f"Price ${q['price']:.2f} ({q.get('change_percent', 0):+.2f}% today)")
    if t:
        bits = [f"{k}={v}" for k, v in t.items() if k != "last"]
        lines.append("Technicals: " + ", ".join(bits))
    if m:
        lines.append("Fundamentals: " + ", ".join(f"{k}={round(v, 2) if isinstance(v, float) else v}" for k, v in m.items()))
    if c:
        lines.append(f"Analyst consensus ({c['analysts']} analysts, {c.get('period')}): {c['view']} — "
                     f"{c['strong_buy']} strong buy, {c['buy']} buy, {c['hold']} hold, {c['sell']} sell, {c['strong_sell']} strong sell")
    if snap.get("next_earnings"):
        lines.append(f"Next earnings: {snap['next_earnings']}")
    for n in (snap.get("news") or [])[:6]:
        lines.append(f"News ({n['published_at'][:10]}, {n['source']}, {n.get('effect', '?')}/{n.get('impact', '?')}): {n['title']}")
    return "\n".join(lines)
