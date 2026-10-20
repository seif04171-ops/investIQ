"""
Watchlist router. Like portfolio/buy, this accepts a ticker directly
and looks up or creates the Company row — no pre-existing company_id needed.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.models.news import Company
from app.models.user_data import User, WatchlistItem
from app.services.market_data import validate_ticker, get_company_profile, MarketDataUnavailable

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


@router.get("/ping")
def ping():
    return {"status": "ok", "router": "watchlist"}


class AddToWatchlistRequest(BaseModel):
    ticker: str
    company_name: str | None = None


@router.get("")
def list_watchlist(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    items = (
        db.query(WatchlistItem, Company)
        .join(Company, Company.id == WatchlistItem.company_id)
        .filter(WatchlistItem.user_id == current_user.id)
        .all()
    )
    return [
        {
            "company_id": str(company.id),
            "ticker": company.ticker,
            "name": company.name,
            "sector": company.sector,
            "added_at": item.added_at.isoformat() if item.added_at else None,
        }
        for item, company in items
    ]


@router.post("")
def add_to_watchlist(
    payload: AddToWatchlistRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticker = payload.ticker.upper().strip()

    try:
        match = validate_ticker(ticker)
    except MarketDataUnavailable:
        raise HTTPException(
            status_code=503,
            detail="Can't verify tickers right now — market data service isn't configured or is unreachable.",
        )
    if not match:
        raise HTTPException(status_code=400, detail=f"'{ticker}' isn't a recognized ticker")

    company = db.query(Company).filter(Company.ticker == ticker).first()
    if not company:
        sector = None
        name = match.get("description") or ticker
        try:
            profile = get_company_profile(ticker)
            sector = profile.get("finnhubIndustry")
            name = profile.get("name") or name
        except Exception:
            pass  # sector is a nice-to-have; never block adding to the watchlist
        company = Company(ticker=ticker, name=name, sector=sector)
        db.add(company)
        db.commit()
        db.refresh(company)

    existing = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == current_user.id, WatchlistItem.company_id == company.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"{ticker} is already on your watchlist")

    db.add(WatchlistItem(user_id=current_user.id, company_id=company.id))
    db.commit()
    return {"status": "added", "ticker": ticker}


@router.delete("/{ticker}")
def remove_from_watchlist(
    ticker: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company = db.query(Company).filter(Company.ticker == ticker.upper().strip()).first()
    if not company:
        raise HTTPException(status_code=404, detail="Unknown ticker")

    item = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.user_id == current_user.id, WatchlistItem.company_id == company.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail=f"{ticker} isn't on your watchlist")

    db.delete(item)
    db.commit()
    return {"status": "removed", "ticker": ticker}
