"""
Portfolio router — paper trading simulator.

Prices are resolved SERVER-SIDE from a live quote whenever one is available,
so a trade can't be placed at a made-up price. (The client-supplied price is
only a fallback when the quote service is unreachable.)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.models.news import Company
from app.models.user_data import User
from app.services import portfolio_service
from app.services.portfolio_service import InsufficientFundsError, InsufficientSharesError
from app.services.market_data import (
    validate_ticker, get_company_profile, get_quote, get_quotes_bulk, get_history,
    MarketDataUnavailable,
)

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/ping")
def ping():
    return {"status": "ok", "router": "portfolio"}


class TradeRequest(BaseModel):
    ticker: str
    company_name: str | None = None
    shares: float
    price_per_share: float | None = None  # fallback only; live quote wins
    note: str | None = None               # decision-journal entry


def _get_or_create_company(db: Session, ticker: str, company_name: str | None) -> Company:
    ticker = ticker.upper().strip()
    company = db.query(Company).filter(Company.ticker == ticker).first()
    if company:
        if not company.sector:
            try:
                profile = get_company_profile(ticker)
                if profile.get("finnhubIndustry"):
                    company.sector = profile["finnhubIndustry"]
                    db.commit()
            except Exception:
                pass
        return company

    sector = None
    resolved_name = company_name or ticker
    try:
        profile = get_company_profile(ticker)
        sector = profile.get("finnhubIndustry")
        resolved_name = profile.get("name") or resolved_name
    except Exception:
        # Profile lookup is a nice-to-have for sector allocation — never
        # block a trade over it.
        pass

    company = Company(ticker=ticker, name=resolved_name, sector=sector)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _resolve_price(ticker: str, client_price: float | None) -> float:
    try:
        live = get_quote(ticker).get("c")
        if live:
            return float(live)
    except MarketDataUnavailable:
        pass
    except Exception:
        pass
    if client_price and client_price > 0:
        return float(client_price)
    raise HTTPException(
        status_code=503,
        detail="Couldn't get a live price for this ticker right now. Try again in a moment.",
    )


def _check_shares(shares: float):
    if not shares or shares <= 0 or shares != shares or shares > 1_000_000_000:
        raise HTTPException(status_code=400, detail="Enter a number of shares greater than zero.")


@router.get("/summary")
def summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    portfolio = portfolio_service.get_or_create_portfolio(db, current_user.id)
    rows = portfolio_service.list_holdings(db, portfolio)
    tickers = [c.ticker for _, c in rows if c and c.ticker]
    try:
        by_ticker = get_quotes_bulk(tickers)
    except Exception:
        by_ticker = {}
    quotes = {
        str(h.company_id): by_ticker.get(c.ticker.upper()) if c and c.ticker else None
        for h, c in rows
    }
    return portfolio_service.get_portfolio_summary(db, portfolio, quotes=quotes)


@router.post("/buy")
def buy(
    payload: TradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_shares(payload.shares)
    try:
        match = validate_ticker(payload.ticker)
    except MarketDataUnavailable:
        raise HTTPException(
            status_code=503,
            detail="Can't verify tickers right now — market data service isn't configured or is unreachable.",
        )
    if not match:
        raise HTTPException(status_code=400, detail=f"'{payload.ticker}' isn't a recognized ticker")

    price = _resolve_price(payload.ticker, payload.price_per_share)
    portfolio = portfolio_service.get_or_create_portfolio(db, current_user.id)
    company = _get_or_create_company(db, payload.ticker, match.get("description"))
    try:
        txn = portfolio_service.buy(db, portfolio, company.id, payload.shares, price, payload.note)
    except InsufficientFundsError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"transaction_id": str(txn.id), "status": "executed", "price": price}


@router.post("/sell")
def sell(
    payload: TradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_shares(payload.shares)
    portfolio = portfolio_service.get_or_create_portfolio(db, current_user.id)
    company = db.query(Company).filter(Company.ticker == payload.ticker.upper().strip()).first()
    if not company:
        raise HTTPException(status_code=400, detail="You don't hold this ticker")
    price = _resolve_price(payload.ticker, payload.price_per_share)
    try:
        txn = portfolio_service.sell(db, portfolio, company.id, payload.shares, price, payload.note)
    except InsufficientSharesError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"transaction_id": str(txn.id), "status": "executed", "price": price}


@router.get("/transactions")
def transactions(
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trade history + decision journal, enriched with how each trade looks now."""
    portfolio = portfolio_service.get_or_create_portfolio(db, current_user.id)
    rows = portfolio_service.list_transactions(db, portfolio, limit=max(1, min(limit, 500)))
    tickers = [c.ticker for _, c in rows if c and c.ticker]
    try:
        quotes = get_quotes_bulk(tickers)
    except Exception:
        quotes = {}

    out = []
    for t, c in rows:
        ticker = c.ticker if c else None
        q = quotes.get(ticker.upper()) if ticker else None
        price = float(t.price_per_share)
        now = q["price"] if q and q.get("price") else None
        out.append({
            "id": str(t.id),
            "ticker": ticker,
            "company": c.name if c else "Unknown",
            "action": t.action,
            "shares": float(t.shares),
            "price": price,
            "note": t.note,
            "executed_at": t.executed_at.isoformat() if t.executed_at else None,
            "current_price": now,
            "since_pct": round((now - price) / price * 100, 2) if now and price else None,
        })
    return out


@router.get("/performance")
def performance(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    "Your current holdings, over the last N days" — a hypothetical value
    curve (today's shares × each past day's close). Clearly labeled as such:
    it isn't your actual historical balance.
    """
    portfolio = portfolio_service.get_or_create_portfolio(db, current_user.id)
    rows = portfolio_service.list_holdings(db, portfolio)
    positions = {c.ticker.upper(): float(h.shares) for h, c in rows if c and c.ticker}
    if not positions:
        return {"points": [], "missing": [], "reason": "no_holdings"}

    histories: dict[str, list[dict]] = {}
    missing: list[str] = []
    reason = None
    for ticker in positions:
        try:
            histories[ticker] = get_history(ticker, days)
        except MarketDataUnavailable as exc:
            missing.append(ticker)
            reason = str(exc)
        except Exception:
            missing.append(ticker)

    points = portfolio_service.combine_histories(positions, histories)
    return {"points": points, "missing": missing, "reason": reason if not points else None}


@router.post("/reset")
def reset(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    portfolio = portfolio_service.get_or_create_portfolio(db, current_user.id)
    portfolio_service.reset_portfolio(db, portfolio)
    return {"status": "reset"}
