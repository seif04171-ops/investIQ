"""
Paper trading simulator.

Prices: the *route* layer fetches live quotes and passes them in, so this
module has zero knowledge of where prices come from. That keeps the trading
math testable and the market-data provider swappable.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.news import Company
from app.models.user_data import Portfolio, PortfolioHolding, PortfolioTransaction
from app.services.portfolio_health import compute_health

STARTING_CASH = 100000.0


class InsufficientFundsError(Exception):
    pass


class InsufficientSharesError(Exception):
    pass


def get_or_create_portfolio(db: Session, user_id) -> Portfolio:
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == user_id).first()
    if portfolio:
        return portfolio
    portfolio = Portfolio(user_id=user_id, cash_balance=STARTING_CASH)
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)
    return portfolio


def buy(db: Session, portfolio: Portfolio, company_id, shares: float, price_per_share: float,
        note: str | None = None) -> PortfolioTransaction:
    cost = shares * price_per_share
    if cost > float(portfolio.cash_balance) + 1e-9:
        raise InsufficientFundsError(
            f"This costs ${cost:,.2f} but you only have ${float(portfolio.cash_balance):,.2f} in cash."
        )

    holding = (
        db.query(PortfolioHolding)
        .filter(PortfolioHolding.portfolio_id == portfolio.id, PortfolioHolding.company_id == company_id)
        .first()
    )
    if holding:
        total_shares = float(holding.shares) + shares
        total_cost = float(holding.shares) * float(holding.avg_buy_price) + cost
        holding.avg_buy_price = total_cost / total_shares
        holding.shares = total_shares
    else:
        holding = PortfolioHolding(
            portfolio_id=portfolio.id,
            company_id=company_id,
            shares=shares,
            avg_buy_price=price_per_share,
        )
        db.add(holding)

    portfolio.cash_balance = float(portfolio.cash_balance) - cost

    transaction = PortfolioTransaction(
        portfolio_id=portfolio.id,
        company_id=company_id,
        action="buy",
        shares=shares,
        price_per_share=price_per_share,
        note=(note or "").strip() or None,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def sell(db: Session, portfolio: Portfolio, company_id, shares: float, price_per_share: float,
         note: str | None = None) -> PortfolioTransaction:
    holding = (
        db.query(PortfolioHolding)
        .filter(PortfolioHolding.portfolio_id == portfolio.id, PortfolioHolding.company_id == company_id)
        .first()
    )
    if not holding or float(holding.shares) + 1e-9 < shares:
        raise InsufficientSharesError("You don't own that many shares.")

    proceeds = shares * price_per_share
    holding.shares = float(holding.shares) - shares
    portfolio.cash_balance = float(portfolio.cash_balance) + proceeds

    if float(holding.shares) < 1e-9:
        db.delete(holding)

    transaction = PortfolioTransaction(
        portfolio_id=portfolio.id,
        company_id=company_id,
        action="sell",
        shares=shares,
        price_per_share=price_per_share,
        note=(note or "").strip() or None,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def reset_portfolio(db: Session, portfolio: Portfolio) -> None:
    """Start over with fresh simulated cash — wipes holdings and trade history."""
    db.query(PortfolioHolding).filter(PortfolioHolding.portfolio_id == portfolio.id).delete()
    db.query(PortfolioTransaction).filter(PortfolioTransaction.portfolio_id == portfolio.id).delete()
    portfolio.cash_balance = STARTING_CASH
    db.commit()


def list_holdings(db: Session, portfolio: Portfolio) -> list[tuple[PortfolioHolding, Company | None]]:
    holdings = db.query(PortfolioHolding).filter(PortfolioHolding.portfolio_id == portfolio.id).all()
    out = []
    for h in holdings:
        company = db.query(Company).filter(Company.id == h.company_id).first()
        out.append((h, company))
    return out


def list_transactions(db: Session, portfolio: Portfolio, limit: int = 200) -> list[tuple[PortfolioTransaction, Company | None]]:
    rows = (
        db.query(PortfolioTransaction, Company)
        .outerjoin(Company, Company.id == PortfolioTransaction.company_id)
        .filter(PortfolioTransaction.portfolio_id == portfolio.id)
        .order_by(PortfolioTransaction.executed_at.desc())
        .limit(limit)
        .all()
    )
    return rows


def get_portfolio_summary(db: Session, portfolio: Portfolio, quotes: dict[str, dict | None] | None = None) -> dict:
    """
    quotes: {company_id_str: {price, change, change_percent} | None}.
    A holding with no live quote falls back to its average buy price and is
    flagged (price_is_live=False) — the summary never crashes on a missing
    quote, and the UI can say plainly which numbers aren't live.
    """
    quotes = quotes or {}
    cash = float(portfolio.cash_balance)

    rows = list_holdings(db, portfolio)
    holdings_detail = []
    sector_values: dict[str, float] = {}
    invested = 0.0
    total_cost = 0.0
    day_change_value = 0.0
    stale: list[str] = []

    for h, company in rows:
        q = quotes.get(str(h.company_id))
        shares = float(h.shares)
        avg = float(h.avg_buy_price)
        live = bool(q and q.get("price"))
        price = float(q["price"]) if live else avg
        market_value = shares * price
        cost_basis = shares * avg
        gain_value = market_value - cost_basis
        gain_pct = (price - avg) / avg * 100 if avg else 0.0
        day_val = shares * float(q.get("change") or 0.0) if live else 0.0
        day_pct = float(q.get("change_percent") or 0.0) if live else 0.0

        invested += market_value
        total_cost += cost_basis
        day_change_value += day_val
        ticker = company.ticker if company else None
        if not live:
            stale.append(ticker or (company.name if company else "Unknown"))

        sector = company.sector if company and company.sector else "Unknown"
        sector_values[sector] = sector_values.get(sector, 0.0) + market_value

        holdings_detail.append({
            "company": company.name if company else "Unknown",
            "ticker": ticker,
            "sector": sector,
            "shares": shares,
            "avg_buy_price": avg,
            "current_price": price,
            "price_is_live": live,
            "market_value": market_value,
            "cost_basis": cost_basis,
            "gain_loss_value": round(gain_value, 2),
            "gain_loss_pct": round(gain_pct, 2),
            "day_change_value": round(day_val, 2),
            "day_change_pct": round(day_pct, 2),
        })

    total_value = cash + invested
    for h in holdings_detail:
        h["weight_pct"] = round(h["market_value"] / total_value * 100, 1) if total_value > 0 else 0.0
    holdings_detail.sort(key=lambda x: x["market_value"], reverse=True)

    # Allocation for the donut: sectors + cash, as dollars and % of total.
    allocation = [
        {"label": s, "value": round(v, 2), "pct": round(v / total_value * 100, 1) if total_value else 0.0}
        for s, v in sorted(sector_values.items(), key=lambda kv: kv[1], reverse=True)
    ]
    if cash > 0:
        allocation.append({
            "label": "Cash", "value": round(cash, 2),
            "pct": round(cash / total_value * 100, 1) if total_value else 0.0,
        })

    concentration_warnings = []
    if total_value > 0:
        for sector, value in sector_values.items():
            pct = value / total_value * 100
            if pct > 40 and sector != "Unknown":
                concentration_warnings.append(
                    f"You are heavily concentrated in {sector} ({pct:.0f}% of your portfolio)."
                )

    prev_invested = invested - day_change_value
    day_change_pct = (day_change_value / prev_invested * 100) if prev_invested > 0 else 0.0

    health = compute_health(
        [{"ticker": h["ticker"], "market_value": h["market_value"], "sector": h["sector"]} for h in holdings_detail],
        cash=cash,
        total_value=total_value,
    )

    return {
        "starting_cash": STARTING_CASH,
        "cash_balance": cash,
        "invested_value": round(invested, 2),
        "total_value": round(total_value, 2),
        "total_return_value": round(total_value - STARTING_CASH, 2),
        "total_return_pct": round((total_value - STARTING_CASH) / STARTING_CASH * 100, 2),
        "unrealized_gain_loss": round(invested - total_cost, 2),
        "day_change_value": round(day_change_value, 2),
        "day_change_pct": round(day_change_pct, 2),
        "holdings": holdings_detail,
        "allocation": allocation,
        "sector_exposure_pct": {a["label"]: a["pct"] for a in allocation if a["label"] not in ("Cash",)},
        "concentration_warnings": concentration_warnings,
        "health": health,
        "prices_live": not stale,
        "stale_tickers": stale,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


def combine_histories(positions: dict[str, float], histories: dict[str, list[dict]]) -> list[dict]:
    """
    "If you'd held today's positions" value curve: sum shares × close per day.
    Only days where every included ticker has a price are returned, so the
    line never dips because of a missing data point.
    """
    maps = {t: {h["date"]: h["close"] for h in hist} for t, hist in histories.items() if hist}
    included = {t: s for t, s in positions.items() if t in maps}
    if not included:
        return []
    dates = sorted({d for m in maps.values() for d in m})
    last: dict[str, float] = {}
    out = []
    for d in dates:
        total = 0.0
        complete = True
        for t, shares in included.items():
            if d in maps[t]:
                last[t] = maps[t][d]
            if t in last:
                total += shares * last[t]
            else:
                complete = False
        if complete:
            out.append({"date": d, "value": round(total, 2)})
    return out
