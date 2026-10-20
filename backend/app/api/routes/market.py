"""
Market router: real ticker search, quotes, profiles and history via Finnhub.
"""
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException

from app.services import research, universe
from app.services.market_data import (
    search_symbol, get_quote, get_quotes_bulk, normalize_quote, get_market_overview,
    get_market_sentiment, get_history, get_company_profile, get_basic_metrics,
    MarketDataUnavailable,
)

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/ping")
def ping():
    return {"status": "ok", "router": "market"}


@router.get("/search")
def search(q: str):
    try:
        results = search_symbol(q)
    except MarketDataUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    # Keep plain US-style tickers first; Finnhub also returns exchange-suffixed
    # symbols (AAPL.MX, 0R2V.L) that confuse beginners.
    cleaned = [r for r in results if r.get("symbol") and "." not in r["symbol"]]
    return [
        {"symbol": r.get("symbol"), "description": r.get("description"), "type": r.get("type")}
        for r in cleaned[:8]
    ]


@router.get("/quote/{ticker}")
def quote(ticker: str):
    try:
        data = normalize_quote(get_quote(ticker))
    except MarketDataUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ticker": ticker.upper(), **data}


@router.get("/quotes")
def quotes(tickers: str):
    """Bulk quotes: /market/quotes?tickers=AAPL,MSFT. Unavailable ones are null."""
    try:
        return get_quotes_bulk([t for t in tickers.split(",") if t.strip()][:40])
    except MarketDataUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/stock/{ticker}")
def stock(ticker: str):
    """Everything the stock page needs in one call. Each part degrades independently."""
    symbol = ticker.upper().strip()

    def safe(fn):
        try:
            return fn()
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=3) as pool:
        f_quote = pool.submit(safe, lambda: normalize_quote(get_quote(symbol)))
        f_profile = pool.submit(safe, lambda: get_company_profile(symbol))
        f_stats = pool.submit(safe, lambda: get_basic_metrics(symbol))
        q, profile, stats = f_quote.result(), f_profile.result(), f_stats.result()

    if not q and not profile:
        raise HTTPException(status_code=404, detail=f"No market data found for '{symbol}'")

    return {
        "ticker": symbol,
        "quote": q,
        "profile": {
            "name": profile.get("name"),
            "industry": profile.get("finnhubIndustry"),
            "country": profile.get("country"),
            "exchange": profile.get("exchange"),
            "market_cap_millions": profile.get("marketCapitalization"),
            "logo": profile.get("logo"),
            "website": profile.get("weburl"),
            "ipo": profile.get("ipo"),
        } if profile else None,
        "stats": stats or {},
    }


@router.get("/overview")
def overview():
    """Real quotes for S&P 500, Nasdaq and Dow Jones (raw index or ETF proxy)."""
    try:
        return get_market_overview()
    except MarketDataUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/sentiment")
def sentiment():
    try:
        return get_market_sentiment()
    except MarketDataUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/history/{ticker}")
def history(ticker: str, days: int = 30):
    try:
        return get_history(ticker, days)
    except MarketDataUnavailable as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.get("/popular")
def popular():
    """Well-known stocks grouped by theme, with live prices, plus today's biggest movers."""
    tickers = [s.ticker for s in universe.STOCKS]
    try:
        quotes = get_quotes_bulk(tickers)
    except Exception:
        quotes = {}
    groups = []
    for key, title in universe.CATEGORIES:
        rows = []
        for s in universe.STOCKS:
            if s.category != key:
                continue
            q = quotes.get(s.ticker)
            rows.append({"ticker": s.ticker, "name": s.name, "sector": s.sector,
                         "price": q["price"] if q else None,
                         "change_percent": q["change_percent"] if q else None})
        groups.append({"key": key, "title": title, "stocks": rows})
    live = [r for g in groups if g["key"] != "etf" for r in g["stocks"] if r["change_percent"] is not None]
    live.sort(key=lambda r: r["change_percent"], reverse=True)
    return {
        "groups": groups,
        "gainers": live[:6],
        "losers": list(reversed(live[-6:])) if len(live) > 6 else [],
        "live_count": len(live),
    }


@router.get("/research/{ticker}")
def research_ticker(ticker: str):
    """Price action, technicals, analyst consensus, earnings date, fundamentals and news for ANY ticker."""
    snap = research.snapshot(ticker)
    if not snap.get("quote") and not snap.get("profile"):
        raise HTTPException(status_code=404, detail=f"No market data found for '{ticker.upper()}'")
    return snap
