"""
Portfolio Health: a transparent, rule-based read of how a simulated
portfolio is built. Deliberately NOT advice and NOT a prediction — it
describes structure (diversification, concentration, cash) and explains why
that structure matters, so a beginner learns to see it themselves.

Pure functions (no DB, no network) so every rule is unit-testable.
"""

FACTOR_WEIGHTS = {"diversification": 0.30, "position_size": 0.30, "sector_balance": 0.25, "cash": 0.15}


def _status(score: float) -> str:
    if score >= 75:
        return "good"
    if score >= 50:
        return "watch"
    return "risk"


def _diversification(n_holdings: int) -> dict:
    table = {1: 15, 2: 35, 3: 50, 4: 62, 5: 72, 6: 80, 7: 85}
    score = table.get(n_holdings, 92 if n_holdings >= 8 else 0)
    if n_holdings == 1:
        detail = "You hold a single company, so one bad day for it is a bad day for your whole portfolio."
    elif n_holdings < 5:
        detail = f"You hold {n_holdings} companies. A small number means each one moves your results a lot."
    else:
        detail = f"You hold {n_holdings} companies, which spreads how much any single one can affect you."
    return {
        "key": "diversification",
        "label": "Diversification",
        "score": score,
        "detail": detail,
        "why": "Spreading money across several companies means one disappointment can't sink everything. "
               "Note: a single fund (ETF) already holds many companies inside it.",
        "term": "Diversification",
    }


def _position_size(weights: list[float]) -> dict:
    top = max(weights) if weights else 0
    if top > 50:
        score = 20
    elif top > 35:
        score = 45
    elif top > 25:
        score = 65
    elif top > 15:
        score = 85
    else:
        score = 95
    return {
        "key": "position_size",
        "label": "Position size",
        "score": score,
        "detail": f"Your largest holding is {top:.0f}% of what you've invested.",
        "why": "When one position dominates, the portfolio's fate is mostly that one company's fate. "
               "Many investors look at how big their biggest position is before anything else.",
        "term": "Concentration risk",
    }


def _sector_balance(sector_weights: dict[str, float]) -> dict | None:
    known = {k: v for k, v in sector_weights.items() if k and k != "Unknown"}
    if not known:
        return None
    total = sum(known.values())
    if total <= 0:
        return None
    top_name, top_val = max(known.items(), key=lambda kv: kv[1])
    top_pct = top_val / total * 100
    if top_pct > 60:
        score = 25
    elif top_pct > 45:
        score = 50
    elif top_pct > 30:
        score = 75
    else:
        score = 92
    return {
        "key": "sector_balance",
        "label": "Sector balance",
        "score": score,
        "detail": f"{top_pct:.0f}% of your invested money sits in {top_name}.",
        "why": "Companies in the same sector tend to react to the same news (interest rates, oil prices, regulation). "
               "Owning five companies in one sector is less diversified than it looks.",
        "term": "Sector",
    }


def _cash(cash_pct: float) -> dict:
    if cash_pct > 90:
        score, detail = 30, f"{cash_pct:.0f}% of your portfolio is still cash — almost nothing is invested yet."
    elif cash_pct > 60:
        score, detail = 55, f"{cash_pct:.0f}% of your portfolio is cash, so most of it isn't exposed to the market."
    elif cash_pct >= 5:
        score, detail = 90, f"{cash_pct:.0f}% of your portfolio is cash, a mix of invested money and a buffer."
    else:
        score, detail = 70, "You're almost fully invested, with very little cash left to react to anything."
    return {
        "key": "cash",
        "label": "Cash level",
        "score": score,
        "detail": detail,
        "why": "Cash is a position too: it doesn't swing with the market, but it also doesn't grow. "
               "How much to hold depends on goals and how soon you need the money.",
        "term": "Liquidity",
    }


def grade(score: int) -> str:
    if score >= 80:
        return "Well balanced"
    if score >= 60:
        return "Reasonably balanced"
    if score >= 40:
        return "Worth a closer look"
    return "Highly concentrated"


def compute_health(holdings: list[dict], cash: float, total_value: float) -> dict | None:
    """
    holdings: [{ticker, market_value, sector}] — market_value in dollars.
    Returns None when there is nothing invested (nothing to assess yet).
    """
    invested = sum(h["market_value"] for h in holdings)
    if not holdings or invested <= 0 or total_value <= 0:
        return None

    weights = [h["market_value"] / invested * 100 for h in holdings]
    sector_weights: dict[str, float] = {}
    for h in holdings:
        s = h.get("sector") or "Unknown"
        sector_weights[s] = sector_weights.get(s, 0) + h["market_value"]

    factors = [_diversification(len(holdings)), _position_size(weights)]
    sector_factor = _sector_balance(sector_weights)
    if sector_factor:
        factors.append(sector_factor)
    factors.append(_cash(cash / total_value * 100))

    weight_sum = sum(FACTOR_WEIGHTS[f["key"]] for f in factors)
    overall = round(sum(f["score"] * FACTOR_WEIGHTS[f["key"]] for f in factors) / weight_sum)

    for f in factors:
        f["status"] = _status(f["score"])

    return {
        "score": overall,
        "grade": grade(overall),
        "factors": factors,
        "disclaimer": "This describes how your portfolio is built — it isn't a prediction or a recommendation.",
    }
