"""
Real market data via Finnhub (free tier: ~60 calls/min, covers US equities
quotes + symbol search + company profile + basic metrics).

Everything here is cached in-process with a short TTL. That matters for two
reasons: (1) the free tier is rate-limited, and a single dashboard load can
need a dozen quotes (indices + every holding + watchlist); (2) it makes the
UI feel instant on repeat visits. Quotes are cached ~30s — fresh enough to
feel live, cheap enough to never hit the limit.

If FINNHUB_API_KEY isn't set, these functions raise MarketDataUnavailable —
callers catch that and show a clearly-labeled "not live" state instead of
inventing numbers.
"""
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import httpx

from app.core.config import settings

FINNHUB_BASE = "https://finnhub.io/api/v1"

QUOTE_TTL = 30          # seconds
HISTORY_TTL = 15 * 60
PROFILE_TTL = 24 * 3600
METRICS_TTL = 6 * 3600


class MarketDataUnavailable(Exception):
    """Raised when Finnhub isn't configured or the request fails."""


# --------------------------------------------------------------------------
# Tiny TTL cache (thread-safe). Only successful results are cached, so a
# temporary Finnhub failure never gets "stuck" for the TTL.
# --------------------------------------------------------------------------
_CACHE: dict[str, tuple[float, object]] = {}
_LOCK = threading.Lock()


def _cache_get(key: str):
    with _LOCK:
        item = _CACHE.get(key)
    if item and item[0] > time.time():
        return item[1]
    return None


def _cache_set(key: str, value, ttl: int):
    with _LOCK:
        _CACHE[key] = (time.time() + ttl, value)
        if len(_CACHE) > 2000:  # crude bound so the cache can't grow forever
            now = time.time()
            for k in [k for k, v in _CACHE.items() if v[0] < now]:
                _CACHE.pop(k, None)


def clear_cache():
    with _LOCK:
        _CACHE.clear()


def _require_key():
    if not settings.FINNHUB_API_KEY:
        raise MarketDataUnavailable("FINNHUB_API_KEY is not configured")


def search_symbol(query: str) -> list[dict]:
    """Search for a ticker/company name. Empty list means no matches."""
    _require_key()
    key = f"s:{query.lower().strip()}"
    cached = _cache_get(key)
    if cached is not None:
        return cached  # type: ignore[return-value]
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(
            f"{FINNHUB_BASE}/search",
            params={"q": query, "token": settings.FINNHUB_API_KEY},
        )
        resp.raise_for_status()
        data = resp.json()
    result = data.get("result", [])
    _cache_set(key, result, 3600)
    return result


def validate_ticker(ticker: str) -> dict | None:
    """Exact (case-insensitive) symbol match, or None if it isn't a real ticker."""
    results = search_symbol(ticker)
    ticker_upper = ticker.upper().strip()
    for r in results:
        if r.get("symbol", "").upper() == ticker_upper:
            return r
    return None


def get_quote(ticker: str) -> dict:
    """
    Real current price for a ticker. Finnhub quote shape:
    {c: current, d: change, dp: change %, h: high, l: low, o: open, pc: prev close}
    Raises MarketDataUnavailable if the key is missing or there's no usable data.
    """
    _require_key()
    symbol = ticker.upper().strip()
    key = f"q:{symbol}"
    cached = _cache_get(key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    with httpx.Client(timeout=10.0) as client:
        resp = client.get(
            f"{FINNHUB_BASE}/quote",
            params={"symbol": symbol, "token": settings.FINNHUB_API_KEY},
        )
        resp.raise_for_status()
        data = resp.json()

    # Finnhub returns all-zero fields for an unknown symbol, and null fields
    # for restricted ones (e.g. raw index tickers on a free key). Either way
    # that means "no usable data", not "the price happens to be zero".
    price, high, low = data.get("c"), data.get("h"), data.get("l")
    if price is None or high is None or low is None or (price == 0 and high == 0 and low == 0):
        raise MarketDataUnavailable(f"No quote data for ticker '{ticker}'")

    _cache_set(key, data, QUOTE_TTL)
    return data


def normalize_quote(raw: dict) -> dict:
    """Flatten Finnhub's one-letter keys into something readable."""
    return {
        "price": raw.get("c"),
        "change": raw.get("d") if raw.get("d") is not None else 0.0,
        "change_percent": raw.get("dp") if raw.get("dp") is not None else 0.0,
        "high": raw.get("h"),
        "low": raw.get("l"),
        "open": raw.get("o"),
        "prev_close": raw.get("pc"),
        "as_of": raw.get("t"),
    }


def get_quotes_bulk(tickers: list[str]) -> dict[str, dict | None]:
    """
    Quotes for many tickers at once (parallel, cached). A ticker that fails
    maps to None so callers can label it "not live" instead of dropping it.
    """
    unique = sorted({t.upper().strip() for t in tickers if t and t.strip()})
    if not unique:
        return {}

    def one(t: str):
        try:
            return t, normalize_quote(get_quote(t))
        except Exception:
            return t, None

    with ThreadPoolExecutor(max_workers=6) as pool:
        return dict(pool.map(one, unique))


# Try the actual raw index symbol first (Finnhub may support these even on
# the free tier) — it gives the real index level people expect (S&P ~7,000s,
# Dow ~50,000s). Fall back to a liquid tracking ETF only if the raw symbol
# isn't available on the current plan/key, and flag it with is_proxy.
INDEX_DEFINITIONS = [
    {"index_name": "S&P 500", "raw_symbol": "^GSPC", "etf_fallback": "SPY"},
    {"index_name": "Nasdaq", "raw_symbol": "^IXIC", "etf_fallback": "QQQ"},
    {"index_name": "Dow Jones", "raw_symbol": "^DJI", "etf_fallback": "DIA"},
]


def get_market_overview() -> list[dict]:
    _require_key()
    results = []
    for definition in INDEX_DEFINITIONS:
        for symbol, is_proxy in ((definition["raw_symbol"], False), (definition["etf_fallback"], True)):
            try:
                quote = get_quote(symbol)
            except MarketDataUnavailable:
                continue
            results.append({
                "index_name": definition["index_name"],
                "display_symbol": symbol,
                "is_proxy": is_proxy,
                "price": quote.get("c"),
                "change": quote.get("d") or 0.0,
                "change_percent": quote.get("dp") or 0.0,
            })
            break
    return results


_CANDLES_BLOCKED_UNTIL = 0.0  # epoch seconds; set when Finnhub says our plan can't use candles


def _history_finnhub(symbol: str, days: int) -> list[dict]:
    global _CANDLES_BLOCKED_UNTIL
    if time.time() < _CANDLES_BLOCKED_UNTIL:
        raise MarketDataUnavailable("Price history isn't available on your current Finnhub plan.")
    end = int(time.time())
    start = end - (days * 86400)
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(
            f"{FINNHUB_BASE}/stock/candle",
            params={"symbol": symbol, "resolution": "D", "from": start, "to": end,
                    "token": settings.FINNHUB_API_KEY},
        )
        if resp.status_code in (401, 403):
            _CANDLES_BLOCKED_UNTIL = time.time() + 3600
            raise MarketDataUnavailable("Price history isn't available on your current Finnhub plan.")
        resp.raise_for_status()
        data = resp.json()
    if data.get("s") != "ok":
        raise MarketDataUnavailable(f"No historical data available for '{symbol}'")
    return [{"date": t, "close": c} for t, c in zip(data.get("t", []), data.get("c", []))]


def _history_yahoo(symbol: str, days: int) -> list[dict]:
    """Keyless fallback for daily closes (public chart endpoint)."""
    rng = "1mo" if days <= 31 else "3mo" if days <= 92 else "6mo" if days <= 185 else "1y" if days <= 366 else "2y"
    with httpx.Client(timeout=10.0, headers={"User-Agent": "Mozilla/5.0"}) as client:
        resp = client.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
            params={"range": rng, "interval": "1d"},
        )
        resp.raise_for_status()
        result = (resp.json().get("chart", {}).get("result") or [None])[0]
    if not result:
        raise MarketDataUnavailable(f"No historical data available for '{symbol}'")
    stamps = result.get("timestamp") or []
    closes = ((result.get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
    points = [{"date": int(t), "close": float(c)} for t, c in zip(stamps, closes) if c is not None]
    if not points:
        raise MarketDataUnavailable(f"No historical data available for '{symbol}'")
    cutoff = time.time() - days * 86400
    return [p for p in points if p["date"] >= cutoff] or points


INTRADAY_TTL = 60


def _parse_yahoo_points(payload: dict, symbol: str) -> list[dict]:
    result = (payload.get("chart", {}).get("result") or [None])[0]
    if not result:
        raise MarketDataUnavailable(f"No chart data available for '{symbol}'")
    stamps = result.get("timestamp") or []
    closes = ((result.get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
    points = [{"date": int(t), "close": float(c)} for t, c in zip(stamps, closes) if c is not None]
    if not points:
        raise MarketDataUnavailable(f"No chart data available for '{symbol}'")
    return points


def get_intraday(ticker: str, days: int = 1) -> list[dict]:
    """
    Intraday prices for the latest session (days=1, 5-minute bars) or the last
    week (days<=5, 30-minute bars). Cached for 60 seconds so a polling chart is
    cheap. Raises MarketDataUnavailable if the public source can't be reached.
    """
    symbol = ticker.upper().strip()
    rng, interval = ("1d", "5m") if days <= 1 else ("5d", "30m")
    key = f"i:{symbol}:{rng}"
    cached = _cache_get(key)
    if cached is not None:
        return cached  # type: ignore[return-value]
    try:
        with httpx.Client(timeout=10.0, headers={"User-Agent": "Mozilla/5.0"}) as client:
            resp = client.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                params={"range": rng, "interval": interval},
            )
            resp.raise_for_status()
            points = _parse_yahoo_points(resp.json(), symbol)
    except (httpx.HTTPError, ValueError) as exc:
        raise MarketDataUnavailable(f"Live chart for '{ticker}' couldn't be loaded right now.") from exc
    _cache_set(key, points, INTRADAY_TTL)
    return points


def get_history(ticker: str, days: int = 30) -> list[dict]:
    """
    Daily closing prices for the last `days` days.

    Finnhub's candle endpoint is paid-only on many plans, so when it fails we
    fall back to a free public source. If both fail this raises
    MarketDataUnavailable so the UI says so instead of drawing a fake chart.
    """
    if int(days) <= 5:
        return get_intraday(ticker, int(days))
    days = max(5, min(int(days), 730))
    symbol = ticker.upper().strip()
    key = f"h:{symbol}:{days}"
    cached = _cache_get(key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    errors: list[Exception] = []
    result: list[dict] = []
    for source in (_history_finnhub, _history_yahoo):
        try:
            if source is _history_finnhub:
                _require_key()
            result = source(symbol, days)
            if result:
                break
        except (MarketDataUnavailable, httpx.HTTPError, ValueError) as exc:
            errors.append(exc)
    if not result:
        first = errors[0] if errors else None
        raise MarketDataUnavailable(
            str(first) if isinstance(first, MarketDataUnavailable)
            else f"Price history for '{ticker}' couldn't be loaded right now."
        )
    _cache_set(key, result, HISTORY_TTL)
    return result


def get_company_profile(ticker: str) -> dict:
    """Company profile — name, industry, country, market cap (millions), logo."""
    _require_key()
    symbol = ticker.upper().strip()
    key = f"p:{symbol}"
    cached = _cache_get(key)
    if cached is not None:
        return cached  # type: ignore[return-value]
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(
            f"{FINNHUB_BASE}/stock/profile2",
            params={"symbol": symbol, "token": settings.FINNHUB_API_KEY},
        )
        resp.raise_for_status()
        data = resp.json()
    if data:
        _cache_set(key, data, PROFILE_TTL)
    return data


def get_basic_metrics(ticker: str) -> dict:
    """
    A handful of key stats (P/E, 52-week range, dividend yield, beta).
    Returns only the fields Finnhub actually provided — never invented.
    """
    _require_key()
    symbol = ticker.upper().strip()
    key = f"m:{symbol}"
    cached = _cache_get(key)
    if cached is not None:
        return cached  # type: ignore[return-value]
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(
            f"{FINNHUB_BASE}/stock/metric",
            params={"symbol": symbol, "metric": "all", "token": settings.FINNHUB_API_KEY},
        )
        resp.raise_for_status()
        metric = (resp.json() or {}).get("metric") or {}

    wanted = {
        "pe": metric.get("peTTM") or metric.get("peBasicExclExtraTTM"),
        "week52_high": metric.get("52WeekHigh"),
        "week52_low": metric.get("52WeekLow"),
        "dividend_yield": metric.get("dividendYieldIndicatedAnnual"),
        "beta": metric.get("beta"),
    }
    result = {k: v for k, v in wanted.items() if v is not None}
    _cache_set(key, result, METRICS_TTL)
    return result


def get_market_sentiment() -> dict:
    """
    A simple, honestly-labeled heuristic from the real average movement of
    the three index proxies — not a substitute for an institutional
    sentiment index (VIX, AAII), which needs a paid source.
    """
    overview = get_market_overview()
    if not overview:
        raise MarketDataUnavailable("No index proxy data available for sentiment")

    avg_change_pct = sum(i["change_percent"] for i in overview) / len(overview)

    if avg_change_pct > 0.5:
        label = "Bullish"
    elif avg_change_pct < -0.5:
        label = "Bearish"
    else:
        label = "Neutral"

    # Map roughly -3%..+3% average move onto a 0-100 score, centered at 50
    score = max(0, min(100, round(50 + avg_change_pct * 16.6)))

    return {"label": label, "score": score, "avg_change_percent": round(avg_change_pct, 2)}
