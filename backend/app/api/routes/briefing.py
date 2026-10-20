"""
Briefing router — the "what matters to ME" feed.

Takes the companies a user holds or watches, matches them against clustered
news events, and returns today's moves for those stocks alongside the
headlines that mention them. This is the core personalised loop: not "here is
the news" but "here is the news that touches your money, and why".
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.models.news import Company
from app.models.user_data import User, WatchlistItem
from app.services import news_live, portfolio_service
from app.services.market_data import get_quotes_bulk

router = APIRouter(prefix="/briefing", tags=["briefing"])


@router.get("")
def briefing(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    portfolio = portfolio_service.get_or_create_portfolio(db, current_user.id)

    tracked: dict[str, dict] = {}  # ticker -> {company, relation}
    for h, c in portfolio_service.list_holdings(db, portfolio):
        if c and c.ticker:
            tracked[c.ticker.upper()] = {"company": c, "relation": "holding", "shares": float(h.shares)}
    for item, c in (
        db.query(WatchlistItem, Company)
        .join(Company, Company.id == WatchlistItem.company_id)
        .filter(WatchlistItem.user_id == current_user.id)
        .all()
    ):
        if c.ticker and c.ticker.upper() not in tracked:
            tracked[c.ticker.upper()] = {"company": c, "relation": "watchlist", "shares": 0.0}

    if not tracked:
        return {"tracked_count": 0, "moves": [], "news": [], "status": news_live.status()}

    try:
        quotes = get_quotes_bulk(list(tracked))
    except Exception:
        quotes = {}

    moves = []
    for ticker, info in tracked.items():
        q = quotes.get(ticker)
        moves.append({
            "ticker": ticker,
            "name": info["company"].name,
            "relation": info["relation"],
            "price": q["price"] if q else None,
            "change_percent": q["change_percent"] if q else None,
            "shares": info["shares"],
        })
    moves.sort(key=lambda m: abs(m["change_percent"] or 0), reverse=True)

    mine = set(tracked)
    news = []
    for n in news_live.ranked(limit=news_live.MAX_ITEMS):
        hits = [t for t in n["tickers"] if t in mine]
        if not hits:
            continue
        n["matched_tickers"] = hits
        n["relation"] = "holding" if any(tracked[t]["relation"] == "holding" for t in hits) else "watchlist"
        news.append(n)
        if len(news) >= 15:
            break

    return {"tracked_count": len(tracked), "moves": moves, "news": news, "status": news_live.status()}
