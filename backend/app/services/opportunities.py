"""
Opportunity radar: ranks stocks by how strongly the evidence leans, combining
three things we can actually measure —

  * NEWS      credibility-weighted, recency-weighted stories that mention the
              company and whether each is expected to help or hurt it
  * MOMENTUM  1-month price move and today's move
  * TREND     where the price sits inside its 52-week range

The output is a *signal*, not a prediction or personal advice: every item
lists the exact facts behind its score, the counter-evidence, and how
confident the data is. Pure scoring functions up top (easy to test), data
gathering below.
"""
from __future__ import annotations

import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from app.services import news_live, research, universe
from app.services.market_data import get_basic_metrics, get_history, get_quotes_bulk

LOOKBACK_HOURS = 72
HALF_LIFE_HOURS = 24.0
CACHE_TTL = 300
MAX_CANDIDATES = 30
DEFAULT_PAD = [s.ticker for s in universe.STOCKS if s.category in ('megacap', 'ai')]
WEIGHTS = {"news": 0.45, "momentum": 0.25, "trend": 0.10, "technical": 0.20}
IMPACT_W = {"high": 1.5, "medium": 1.0, "low": 0.5}
EFFECT_SIGN = {"positive": 1.0, "negative": -1.0}

DISCLAIMER = (
    "Signals summarise recent news and price action. They are not predictions, "
    "guarantees or personal investment advice — do your own research."
)


# ----------------------------------------------------------------- scoring

def recency_weight(age_hours: float) -> float:
    return 0.5 ** (max(age_hours, 0.0) / HALF_LIFE_HOURS)


def news_score(stories: list[dict]) -> float | None:
    """50 = neutral. Credible, fresh, positive stories push it up; negative push it down."""
    if not stories:
        return None
    net = sum(
        EFFECT_SIGN.get(s["effect"], 0.0) * IMPACT_W.get(s.get("impact"), 1.0) * ((s.get("credibility") or 40) / 100.0) * recency_weight(s["age_hours"])
        for s in stories
    )
    return 50 + 50 * math.tanh(net / 1.5)


def momentum_score(ret_1m: float | None, day_pct: float | None) -> float | None:
    parts = []
    if ret_1m is not None:
        parts.append((50 + 50 * math.tanh(ret_1m / 12.0), 0.7))
    if day_pct is not None:
        parts.append((50 + 50 * math.tanh(day_pct / 3.0), 0.3))
    if not parts:
        return None
    total = sum(w for _, w in parts)
    return sum(s * w for s, w in parts) / total


def range_position(price: float | None, low: float | None, high: float | None) -> float | None:
    if price is None or low is None or high is None or high <= low:
        return None
    return max(0.0, min(1.0, (price - low) / (high - low)))


def combine(components: dict[str, float | None]) -> float | None:
    live = {k: v for k, v in components.items() if v is not None}
    if not live:
        return None
    total = sum(WEIGHTS[k] for k in live)
    return sum(v * WEIGHTS[k] for k, v in live.items()) / total


def label_for(score: float) -> tuple[str, str]:
    if score >= 68:
        return "Strong bullish signals", "bullish"
    if score >= 58:
        return "Leaning bullish", "bullish"
    if score > 42:
        return "Mixed signals", "neutral"
    if score > 32:
        return "Leaning bearish", "bearish"
    return "Bearish signals", "bearish"


def confidence_for(stories: list[dict], has_price_data: bool) -> str:
    n = len(stories)
    avg = sum((s.get("credibility") or 0) for s in stories) / n if n else 0
    if n >= 2 and avg >= 70 and has_price_data:
        return "High"
    if n >= 1 and avg >= 50:
        return "Medium"
    return "Low"


def _ago(hours: float) -> str:
    if hours < 1:
        return f"{max(1, int(hours * 60))}m ago"
    if hours < 48:
        return f"{int(hours)}h ago"
    return f"{int(hours // 24)}d ago"


def explain(stories: list[dict], ret_1m, day_pct, pos, direction: str, tech: dict | None = None) -> tuple[list[str], list[str]]:
    reasons: list[str] = []
    risks: list[str] = []

    if stories:
        pos_n = sum(1 for s in stories if s["effect"] == "positive")
        neg_n = sum(1 for s in stories if s["effect"] == "negative")
        avg = round(sum((s.get("credibility") or 0) for s in stories) / len(stories))
        reasons.append(
            f"{len(stories)} {'story' if len(stories) == 1 else 'stories'} in the last {LOOKBACK_HOURS}h "
            f"(avg credibility {avg}/100): {pos_n} positive, {neg_n} negative for this company."
        )
        newest = min(stories, key=lambda s: s["age_hours"])
        reasons.append(f"Latest: “{newest['title']}” ({_ago(newest['age_hours'])}).")
        against = neg_n if direction == "bullish" else pos_n if direction == "bearish" else 0
        if against:
            risks.append(f"{against} {'story points' if against == 1 else 'stories point'} the other way.")
        if len(stories) == 1:
            risks.append("Based on a single story — treat as unconfirmed until more outlets report it.")
    else:
        risks.append("No recent news found — this reading is price action only.")

    if ret_1m is not None:
        move = f"{'Up' if ret_1m >= 0 else 'Down'} {abs(ret_1m):.1f}% over the past month"
        if day_pct is not None:
            move += f" and {day_pct:+.1f}% today"
        reasons.append(move + ".")
        if ret_1m > 15 and direction == "bullish":
            risks.append(f"Already up {ret_1m:.0f}% this month — some of the good news may be priced in.")
        if ret_1m < -15 and direction == "bearish":
            risks.append(f"Already down {abs(ret_1m):.0f}% this month — a bounce is possible.")
    elif day_pct is not None:
        reasons.append(f"{day_pct:+.1f}% today.")

    if pos is not None:
        pct = round(pos * 100)
        where = "near its 52-week high" if pos >= 0.85 else "near its 52-week low" if pos <= 0.15 else "mid-range"
        reasons.append(f"Trading at {pct}% of its 52-week range ({where}).")
        if pos >= 0.92 and direction == "bullish":
            risks.append("Close to its 52-week high, so there is less cushion if sentiment turns.")

    tech = tech or {}
    if tech.get("trend"):
        reasons.append(f"Technical picture: {tech['trend']}" + (f", RSI {tech['rsi14']:.0f}" if tech.get("rsi14") is not None else "") + ".")
    r = tech.get("rsi14")
    if r is not None and r >= 70 and direction == "bullish":
        risks.append(f"RSI {r:.0f} says the stock is stretched short-term — pullbacks are common from here.")
    if r is not None and r <= 30 and direction == "bearish":
        risks.append(f"RSI {r:.0f} says the stock is oversold — a bounce is possible.")
    risks.append("News-driven signals fade quickly and can be wrong.")
    return reasons, risks


# ------------------------------------------------------------ data gathering

_cache: dict[frozenset, tuple[float, dict]] = {}
_lock = threading.Lock()


def clear_cache() -> None:
    with _lock:
        _cache.clear()


def _market_facts(ticker: str) -> dict:
    out: dict = {}
    try:
        closes = [p["close"] for p in get_history(ticker, 120)]
        out["tech"] = research.technicals(closes)
        out["ret_1m"] = out["tech"].get("ret_1m")
    except Exception:
        pass
    try:
        m = get_basic_metrics(ticker)
        out["low"], out["high"] = m.get("week52_low"), m.get("week52_high")
    except Exception:
        pass
    return out


def _story(n: dict) -> dict:
    return {
        "id": n["id"], "title": n["title"], "effect": n.get("effect") or "neutral", "impact": n.get("impact"),
        "credibility": n.get("credibility"), "when": n["published_at"], "age_hours": n["age_hours"],
        "url": n.get("url"), "source": n.get("source"), "why": n.get("why"),
    }


def build_opportunities(db=None, relations: dict[str, dict] | None = None, now: datetime | None = None) -> dict:
    """
    Scans the whole universe (not just the user's list). relations: ticker ->
    {"relation": "holding"|"watchlist", "name": str}; those are always scored.
    """
    relations = relations or {}
    cache_key = frozenset(relations)
    with _lock:
        hit = _cache.get(cache_key)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1]

    news = news_live.get_items(limit=news_live.MAX_ITEMS, max_age_hours=LOOKBACK_HOURS, market_wide=False)
    stories: dict[str, list[dict]] = {}
    for n in news:
        for t in n["tickers"]:
            stories.setdefault(t, []).append(_story(n))
    newest = news_live.status().get("newest_at")

    def weight(t: str) -> float:
        return sum(((s.get("credibility") or 40) / 100) * recency_weight(s["age_hours"]) * IMPACT_W.get(s.get("impact"), 1.0)
                   for s in stories[t])

    candidates = list(relations)
    for t in sorted(stories, key=weight, reverse=True):
        if t not in candidates and t in universe.BY_TICKER:
            candidates.append(t)
    for t in DEFAULT_PAD:                       # never show an empty radar, even if news sources are down
        if len(candidates) >= 14:
            break
        if t not in candidates:
            candidates.append(t)
    candidates = candidates[:MAX_CANDIDATES]

    try:
        quotes = get_quotes_bulk(candidates)
    except Exception:
        quotes = {}
    live = [t for t in candidates if quotes.get(t)]
    with ThreadPoolExecutor(max_workers=6) as ex:
        facts = dict(zip(live, ex.map(_market_facts, live)))

    items = []
    for t in live:
        q, f = quotes[t], facts.get(t, {})
        st = sorted(stories.get(t, []), key=lambda s: s["age_hours"])
        tech = f.get("tech") or {}
        ret_1m = f.get("ret_1m")
        pos = range_position(q["price"], f.get("low"), f.get("high"))
        score_f = combine({
            "news": news_score(st),
            "momentum": momentum_score(ret_1m, q.get("change_percent")),
            "trend": None if pos is None else pos * 100,
            "technical": research.technical_score(q["price"], tech),
        })
        if score_f is None:
            continue
        score = int(round(score_f))
        label, direction = label_for(score)
        reasons, risks = explain(st, ret_1m, q.get("change_percent"), pos, direction, tech)
        meta = universe.BY_TICKER.get(t)
        items.append({
            "ticker": t,
            "name": universe.name_for(t) if meta else (relations.get(t, {}).get("name") or t),
            "sector": meta.sector if meta else None,
            "category": meta.category if meta else None,
            "price": q["price"],
            "change_percent": q.get("change_percent"),
            "score": score, "label": label, "direction": direction,
            "confidence": confidence_for(st, ret_1m is not None or pos is not None),
            "reasons": reasons, "risks": risks,
            "stories": st[:4], "story_count": len(st),
            "ret_1m": None if ret_1m is None else round(ret_1m, 1),
            "range_position": None if pos is None else round(pos, 2),
            "rsi": tech.get("rsi14"), "trend": tech.get("trend"),
            "relation": relations.get(t, {}).get("relation"),
        })
    items.sort(key=lambda i: i["score"], reverse=True)

    result = {"items": items, "newest_story_at": newest, "disclaimer": DISCLAIMER,
              "scanned": len(live), "news_sources": news_live.status().get("sources")}
    if items:   # only cache real results so a transient outage isn't remembered
        with _lock:
            _cache[cache_key] = (time.time(), result)
    return result
