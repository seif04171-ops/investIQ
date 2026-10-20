"""
Live, ticker-linked market news.

Independent of the old event pipeline (which needed OpenAI embeddings and
silently produced nothing without them). Every refresh:

  1. pulls headlines from Finnhub (general + per-company) and Yahoo Finance RSS
     (per-ticker) — all free, no extra keys beyond FINNHUB_API_KEY;
  2. tags each headline with the stocks it is about;
  3. drops duplicates and anything older than MAX_AGE_DAYS;
  4. annotates each story (helps / hurts / neutral, how big, why) — Claude when
     ANTHROPIC_API_KEY works, a transparent keyword heuristic otherwise;
  5. keeps the result in memory and on disk, so the app shows news instantly
     after a restart and the page can never be "empty because a job failed".

Errors are collected and returned to the UI instead of being swallowed.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path

import httpx

from app.core.config import settings
from app.services import universe

logger = logging.getLogger(__name__)

MAX_AGE_DAYS = 7
MAX_ITEMS = 400
MIN_GAP_SECONDS = 20
CACHE_FILE = Path(__file__).resolve().parents[2] / ".cache" / "live_news.json"
FINNHUB = "https://finnhub.io/api/v1"
UA = {"User-Agent": "Mozilla/5.0 (InvestIQ)"}

_lock = threading.Lock()
_items: list[dict] = []
_state: dict = {
    "running": False, "started_at": None, "finished_at": None, "error": None,
    "new_articles": 0, "new_events": 0, "sources": {}, "annotated_by": None,
}

# --------------------------------------------------------------- credibility

_CRED = [
    (("reuters", "bloomberg", "associated press", "ap news", "wall street journal", "wsj", "financial times", "ft.com"), 90),
    (("cnbc", "barron", "marketwatch", "forbes", "fortune", "investor's business", "ibd", "the economist", "axios"), 78),
    (("yahoo", "business insider", "benzinga", "thestreet", "investopedia", "zacks", "nasdaq", "tipranks", "seeking alpha"), 60),
    (("motley fool", "insider monkey", "simply wall", "gurufocus", "24/7", "stocktwits", "investorplace"), 45),
]


def credibility_for(source: str | None) -> int:
    s = (source or "").lower()
    for names, score in _CRED:
        if any(n in s for n in names):
            return score
    return 50


# ---------------------------------------------------------- heuristic scoring

_POS = {
    "beats", "beat", "surges", "surge", "soars", "soar", "jumps", "jump", "rallies", "rally", "record", "upgrade", "upgraded",
    "raises", "raised", "outperform", "buy rating", "strong", "growth", "profit", "wins", "approval", "approved", "partnership",
    "expands", "boost", "boosts", "gains", "climbs", "tops", "bullish", "breakthrough", "deal", "buyback", "dividend hike",
}
_NEG = {
    "misses", "miss", "plunges", "plunge", "falls", "fall", "drops", "drop", "slumps", "tumbles", "downgrade", "downgraded",
    "cuts", "cut", "lawsuit", "sues", "probe", "investigation", "recall", "layoffs", "warns", "warning", "weak", "loss",
    "losses", "bankruptcy", "fraud", "fine", "fined", "ban", "banned", "delay", "delays", "slashes", "bearish", "halts", "sinks",
    "tariff", "tariffs", "short seller", "resigns",
}
_BIG = {"earnings", "guidance", "acquire", "acquisition", "merger", "fda", "approval", "sec ", "antitrust", "recall", "bankruptcy",
        "ceo", "outlook", "forecast", "buyout", "takeover", "upgrade", "downgrade", "layoffs", "lawsuit"}


def heuristic_annotation(title: str, summary: str = "") -> dict:
    text = f"{title} {summary[:200]}".lower()
    words = set(re.findall(r"[a-z']+", text))
    pos = len(words & _POS) + sum(1 for p in _POS if " " in p and p in text)
    neg = len(words & _NEG) + sum(1 for p in _NEG if " " in p and p in text)
    effect = "positive" if pos > neg else "negative" if neg > pos else "neutral"
    big = any(b in text for b in _BIG)
    impact = "high" if big and (pos != neg) else "medium" if big or pos != neg else "low"
    why = {
        "positive": "Headline wording points to good news for the company.",
        "negative": "Headline wording points to bad news for the company.",
        "neutral": "No clear positive or negative direction from the headline alone.",
    }[effect]
    return {"effect": effect, "impact": impact, "why": why}


# ------------------------------------------------------------------- parsing

def _clean(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", text))).strip()


def _item(title, url, source, published: datetime, summary="", tickers=None) -> dict | None:
    title = _clean(title)
    if not title or not url:
        return None
    tags = list(dict.fromkeys((tickers or []) + universe.find_tickers_in_text(f"{title}. {summary[:300]}")))
    return {
        "id": hashlib.sha1(re.sub(r"\W+", "", title.lower())[:120].encode()).hexdigest()[:16],
        "title": title,
        "summary": _clean(summary)[:400],
        "url": url,
        "source": _clean(source) or "Unknown",
        "published_at": published.astimezone(timezone.utc).isoformat(),
        "tickers": tags,
    }


def parse_yahoo_rss(xml_text: str, ticker: str | None = None) -> list[dict]:
    out = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return out
    for it in root.iter("item"):
        pub = it.findtext("pubDate")
        try:
            when = parsedate_to_datetime(pub) if pub else None
        except Exception:
            when = None
        if when is None:
            continue
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        src = it.findtext("source") or "Yahoo Finance"
        row = _item(it.findtext("title"), it.findtext("link"), src, when, it.findtext("description") or "",
                    [ticker] if ticker else None)
        if row:
            out.append(row)
    return out


def parse_finnhub(rows: list[dict], ticker: str | None = None) -> list[dict]:
    out = []
    for r in rows or []:
        ts = r.get("datetime")
        if not ts:
            continue
        row = _item(r.get("headline"), r.get("url"), r.get("source"), datetime.fromtimestamp(int(ts), tz=timezone.utc),
                    r.get("summary") or "", [ticker] if ticker else None)
        if row:
            out.append(row)
    return out


# -------------------------------------------------------------------- fetching

def _fetch_finnhub_general(client: httpx.Client) -> list[dict]:
    r = client.get(f"{FINNHUB}/news", params={"category": "general", "token": settings.FINNHUB_API_KEY})
    r.raise_for_status()
    return parse_finnhub(r.json())


def _fetch_finnhub_company(client: httpx.Client, ticker: str) -> list[dict]:
    today = datetime.now(timezone.utc).date()
    r = client.get(f"{FINNHUB}/company-news", params={
        "symbol": ticker, "from": (today - timedelta(days=4)).isoformat(), "to": today.isoformat(),
        "token": settings.FINNHUB_API_KEY,
    })
    r.raise_for_status()
    return parse_finnhub(r.json()[:8], ticker)


def _fetch_yahoo(client: httpx.Client, ticker: str) -> list[dict]:
    r = client.get("https://feeds.finance.yahoo.com/rss/2.0/headline",
                   params={"s": ticker, "region": "US", "lang": "en-US"})
    r.raise_for_status()
    return parse_yahoo_rss(r.text, ticker)[:8]


def fetch_all(tickers: list[str]) -> tuple[list[dict], dict]:
    """Returns (raw items, per-source report {name: {"ok": n, "failed": n, "error": str|None}})."""
    report = {k: {"ok": 0, "failed": 0, "error": None} for k in ("finnhub", "yahoo")}
    items: list[dict] = []

    def run(name, fn):
        try:
            got = fn()
            report[name]["ok"] += 1
            return got
        except Exception as exc:
            report[name]["failed"] += 1
            report[name]["error"] = f"{type(exc).__name__}: {exc}"[:160]
            return []

    with httpx.Client(timeout=12.0, headers=UA) as client:
        jobs = []
        if settings.FINNHUB_API_KEY:
            jobs.append(("finnhub", lambda: _fetch_finnhub_general(client)))
            for t in tickers[:30]:
                jobs.append(("finnhub", lambda t=t: _fetch_finnhub_company(client, t)))
        else:
            report["finnhub"]["error"] = "FINNHUB_API_KEY not set"
        for t in tickers:
            jobs.append(("yahoo", lambda t=t: _fetch_yahoo(client, t)))
        with ThreadPoolExecutor(max_workers=8) as pool:
            for got in pool.map(lambda j: run(*j), jobs):
                items.extend(got)
    return items, report


# ------------------------------------------------------------------ annotation

_SYSTEM = (
    "You are a markets news analyst. For each numbered headline decide how it affects the stocks it mentions. "
    "Return JSON only: {\"items\": [{\"n\": <number>, \"effect\": \"positive\"|\"negative\"|\"neutral\", "
    "\"impact\": \"high\"|\"medium\"|\"low\", \"why\": \"<one plain sentence, max 25 words, why it matters to shareholders>\"}]}. "
    "Be conservative: marketing fluff, listicles, 'should you buy' pieces and rehashed news are neutral/low. "
    "Only call impact high for earnings, guidance, M&A, regulation, major product/legal events."
)


def annotate(items: list[dict]) -> str:
    """Fills effect/impact/why on every item. Returns who did it: 'claude', 'heuristic' or 'mixed'."""
    for it in items:
        if "effect" not in it:
            it.update(heuristic_annotation(it["title"], it.get("summary", "")), annotated_by="heuristic")
    todo = [it for it in items if it.get("annotated_by") != "claude"]
    if not todo or not settings.ANTHROPIC_API_KEY:
        return "heuristic"
    from app.services.ai_analysis.claude_client import ask_for_json

    done = 0
    for start in range(0, min(len(todo), 90), 30):
        batch = todo[start:start + 30]
        prompt = "\n".join(
            f"{i}. [{', '.join(b['tickers']) or 'market'}] {b['title']} — {b['summary'][:160]}" for i, b in enumerate(batch)
        )
        try:
            data = ask_for_json(_SYSTEM, prompt, max_tokens=2500)
        except Exception as exc:
            logger.warning("Claude annotation failed: %s", exc)
            _state["error_annotation"] = f"{type(exc).__name__}: {exc}"[:160]
            break
        for row in data.get("items", []):
            try:
                b = batch[int(row["n"])]
            except Exception:
                continue
            if row.get("effect") in ("positive", "negative", "neutral") and row.get("impact") in ("high", "medium", "low"):
                b.update(effect=row["effect"], impact=row["impact"], why=str(row.get("why", ""))[:200], annotated_by="claude")
                done += 1
    if done == 0:
        return "heuristic"
    return "claude" if all(i.get("annotated_by") == "claude" for i in items) else "mixed"


# ------------------------------------------------------------------ store / API

def _age_hours(iso: str, now: datetime) -> float:
    return max(0.0, (now - datetime.fromisoformat(iso)).total_seconds() / 3600)


def merge(existing: list[dict], fresh: list[dict], now: datetime | None = None) -> list[dict]:
    """Dedupe by id (keeps existing annotations), drop old items, newest first."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=MAX_AGE_DAYS)
    by_id = {i["id"]: i for i in existing}
    for f in fresh:
        old = by_id.get(f["id"])
        if old:
            old["tickers"] = list(dict.fromkeys(old["tickers"] + f["tickers"]))
            continue
        by_id[f["id"]] = f
    kept = [i for i in by_id.values() if datetime.fromisoformat(i["published_at"]) >= cutoff]
    kept.sort(key=lambda i: i["published_at"], reverse=True)
    return kept[:MAX_ITEMS]


def _save() -> None:
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        CACHE_FILE.write_text(json.dumps({"items": _items, "finished_at": _state["finished_at"]}))
    except Exception:
        logger.warning("Could not write news cache", exc_info=True)


def load_cache() -> None:
    try:
        data = json.loads(CACHE_FILE.read_text())
        with _lock:
            _items[:] = data.get("items", [])
            _state["finished_at"] = _state["finished_at"] or data.get("finished_at")
    except Exception:
        pass


def tracked_tickers(extra: list[str] | None = None) -> list[str]:
    seen = list(dict.fromkeys([*(extra or []), *universe.SCAN_TICKERS]))
    return seen[:45]


def _run(extra: list[str]) -> None:
    error = None
    new = 0
    sources: dict = {}
    annotated_by = None
    try:
        raw, sources = fetch_all(tracked_tickers(extra))
        if not raw:
            msgs = [f"{k}: {v['error']}" for k, v in sources.items() if v["error"]]
            error = "No headlines could be fetched. " + "; ".join(msgs) if msgs else "No headlines were returned."
        with _lock:
            before = {i["id"] for i in _items}
            merged = merge(_items, raw)
        annotated_by = annotate(merged)
        with _lock:
            _items[:] = merged
            new = sum(1 for i in merged if i["id"] not in before)
    except Exception as exc:
        logger.exception("Live news refresh failed")
        error = f"{type(exc).__name__}: {exc}"[:300]
    finally:
        try:
            from app.services import opportunities
            opportunities.clear_cache()
        except Exception:
            pass
        with _lock:
            _state.update(running=False, finished_at=time.time() if not error or new else _state["finished_at"],
                          error=error, new_articles=new, new_events=new, sources=sources, annotated_by=annotated_by)
        _save()


def start_refresh(force: bool = False, extra_tickers: list[str] | None = None) -> dict:
    with _lock:
        if _state["running"]:
            return {**_state, "started": False}
        recent = _state["finished_at"] and time.time() - _state["finished_at"] < MIN_GAP_SECONDS
        if recent and not force:
            return {**_state, "started": False}
        _state.update(running=True, started_at=time.time(), error=None)
    threading.Thread(target=_run, args=(extra_tickers or [],), daemon=True, name="live-news").start()
    return {**status(), "started": True}


def status() -> dict:
    with _lock:
        s = dict(_state)
        s["item_count"] = len(_items)
        s["newest_at"] = _items[0]["published_at"] if _items else None
    return s


def get_items(ticker: str | None = None, effect: str | None = None, limit: int = 60,
              max_age_hours: float | None = None, market_wide: bool = True) -> list[dict]:
    now = datetime.now(timezone.utc)
    with _lock:
        rows = [dict(i) for i in _items]
    out = []
    for i in rows:
        age = _age_hours(i["published_at"], now)
        if max_age_hours is not None and age > max_age_hours:
            continue
        if ticker and ticker.upper() not in i["tickers"]:
            continue
        if effect and i.get("effect") != effect:
            continue
        if not i["tickers"] and not market_wide:
            continue
        i["age_hours"] = round(age, 2)
        i["credibility"] = credibility_for(i["source"])
        i["names"] = {t: universe.name_for(t) for t in i["tickers"][:4]}
        out.append(i)
        if len(out) >= limit:
            break
    return out


def ranked(limit: int = 60, **kw) -> list[dict]:
    """Newest-first, but stories that move stocks (clear direction, high impact) beat filler."""
    pool = get_items(limit=MAX_ITEMS, **kw)
    wt = {"high": 3.0, "medium": 1.6, "low": 0.7}

    def score(i):
        base = wt.get(i.get("impact"), 1.0) * (i["credibility"] / 60)
        if i.get("effect") == "neutral":
            base *= 0.6
        if not i["tickers"]:
            base *= 0.5
        return base * (0.5 ** (i["age_hours"] / 18))

    pool.sort(key=score, reverse=True)
    return pool[:limit]


load_cache()
