"""Opportunity radar: ranked, explained stock signals built from news + price action."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.models.news import Company
from app.models.user_data import User, WatchlistItem
from app.services import opportunities, portfolio_service

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


def user_relations(db: Session, user: User) -> dict[str, dict]:
    rel: dict[str, dict] = {}
    portfolio = portfolio_service.get_or_create_portfolio(db, user.id)
    for h, c in portfolio_service.list_holdings(db, portfolio):
        if c and c.ticker:
            rel[c.ticker.upper()] = {"relation": "holding", "name": c.name}
    for _, c in (
        db.query(WatchlistItem, Company)
        .join(Company, Company.id == WatchlistItem.company_id)
        .filter(WatchlistItem.user_id == user.id)
        .all()
    ):
        if c.ticker and c.ticker.upper() not in rel:
            rel[c.ticker.upper()] = {"relation": "watchlist", "name": c.name}
    return rel


@router.get("")
def list_opportunities(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return opportunities.build_opportunities(db, user_relations(db, current_user))
