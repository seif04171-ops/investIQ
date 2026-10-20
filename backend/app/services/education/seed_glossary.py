"""
Seed data for glossary_terms. Run once via `python -m app.services.education.seed_glossary`
(or call `seed_glossary(db)` from a migration/startup script).
Covers the terms explicitly listed in the product brief.
"""
from sqlalchemy.orm import Session

from app.models.user_data import GlossaryTerm

TERMS = [
    {
        "term": "P/E ratio",
        "simple_explanation": "A way to measure if a stock's price is expensive or cheap compared to the money the company actually makes.",
        "example": "If a company's stock costs $100 and it earns $5 per share a year, its P/E ratio is 20 — investors are paying $20 for every $1 of yearly profit.",
        "why_it_matters": "Comparing P/E ratios helps you judge whether a stock is priced high or low relative to its earnings.",
    },
    {
        "term": "Inflation",
        "simple_explanation": "The rate at which prices for goods and services rise over time, making each dollar buy a little less.",
        "example": "If a coffee costs $4 today and inflation is 3% a year, it'll cost roughly $4.12 next year.",
        "why_it_matters": "Inflation affects interest rates, company costs, and how much your savings are really worth over time.",
    },
    {
        "term": "Interest rates",
        "simple_explanation": "The cost of borrowing money, or the reward for saving it, set largely by central banks.",
        "example": "When a central bank raises rates, a mortgage or business loan becomes more expensive.",
        "why_it_matters": "Higher rates tend to slow borrowing and spending; lower rates tend to encourage it — this ripples through nearly every sector.",
    },
    {
        "term": "GDP",
        "simple_explanation": "Gross Domestic Product — the total value of everything a country produces in a year.",
        "example": "If GDP grows 3% this year, the country's economy produced 3% more than last year.",
        "why_it_matters": "GDP growth (or shrinkage) is one of the main signals investors use to judge the health of an economy.",
    },
    {
        "term": "Earnings",
        "simple_explanation": "The profit a company reports, usually announced every three months.",
        "example": "A company might announce it earned $2 billion last quarter, beating or missing what analysts expected.",
        "why_it_matters": "Stock prices often move sharply around earnings reports as investors react to whether results beat or missed expectations.",
    },
    {
        "term": "Market capitalization",
        "simple_explanation": "The total value of a company's shares — share price multiplied by number of shares.",
        "example": "A company with 1 billion shares at $50 each has a $50 billion market cap.",
        "why_it_matters": "Market cap is used to categorize companies as small, mid, or large — which affects risk and volatility expectations.",
    },
    {
        "term": "ETFs",
        "simple_explanation": "Exchange-Traded Funds — a basket of many stocks or bonds bundled into a single investment you can buy like one stock.",
        "example": "An S&P 500 ETF gives you a small slice of all 500 companies in that index in one purchase.",
        "why_it_matters": "ETFs are a common way for beginners to diversify without having to pick individual stocks.",
    },
    {
        "term": "Diversification",
        "simple_explanation": "Spreading your money across different investments so one bad outcome doesn't sink your whole portfolio.",
        "example": "Owning stocks in tech, healthcare, and energy instead of only tech.",
        "why_it_matters": "It's one of the most reliable ways to reduce risk without necessarily reducing expected returns.",
    },
    {
        "term": "Supply chains",
        "simple_explanation": "The network of suppliers, factories, and shippers that get a product from raw materials to the store shelf.",
        "example": "A phone's supply chain might include chip factories in Taiwan, assembly in Vietnam, and shipping worldwide.",
        "why_it_matters": "Disruptions anywhere in a supply chain (weather, conflict, shortages) can affect company costs and stock prices.",
    },
    {
        "term": "Bonds",
        "simple_explanation": "A loan you give to a government or company, which pays you back with interest over time.",
        "example": "Buying a 10-year government bond means you lend money for 10 years in exchange for regular interest payments.",
        "why_it_matters": "Bonds are generally lower-risk than stocks and often move in the opposite direction, which matters for diversification.",
    },
    {
        "term": "Concentration risk",
        "simple_explanation": "The risk that comes from having too much of your money in one company, sector or idea.",
        "example": "If 60% of your portfolio is one tech stock and that company has a bad quarter, your whole portfolio feels it.",
        "why_it_matters": "Spreading money out means no single disappointment can do too much damage.",
    },
    {
        "term": "Sector",
        "simple_explanation": "A group of companies that do similar things, like technology, healthcare or energy.",
        "example": "Apple and Microsoft are both in the technology sector; Exxon is in energy.",
        "why_it_matters": "Companies in the same sector often react to the same news, so owning several from one sector is less diversified than it looks.",
    },
    {
        "term": "Liquidity",
        "simple_explanation": "How quickly you can turn something into cash without losing value.",
        "example": "Cash is perfectly liquid. A house is not — selling it takes months.",
        "why_it_matters": "Knowing how much of your money you can reach quickly helps you avoid being forced to sell at a bad time.",
    },
    {
        "term": "Volatility",
        "simple_explanation": "How much and how fast a price jumps around.",
        "example": "A stock that swings 5% most days is more volatile than one that moves 0.5%.",
        "why_it_matters": "Higher volatility means a bumpier ride — more chance of big gains, and of big losses.",
    },
    {
        "term": "Dividend",
        "simple_explanation": "A share of a company's profit paid out to its shareholders, usually in cash.",
        "example": "A company pays $1 per share per year; if you own 100 shares, you receive $100.",
        "why_it_matters": "Dividends are one way investors get paid without selling their shares.",
    },
    {
        "term": "Bull and bear markets",
        "simple_explanation": "A bull market is a long period of rising prices; a bear market is a long period of falling prices (usually 20% or more from the peak).",
        "example": "Markets rose for most of the 2010s (bull) and fell sharply in early 2020 (bear).",
        "why_it_matters": "Markets move in cycles, so knowing which phase people say we're in helps you read the news calmly.",
    },
    {
        "term": "Index",
        "simple_explanation": "A scoreboard that tracks a group of stocks to show how a market or slice of it is doing.",
        "example": "The S&P 500 tracks 500 large US companies; when people say 'the market is up', they often mean an index.",
        "why_it_matters": "Indexes give you a quick benchmark to compare your own portfolio against.",
    },
    {
        "term": "Paper trading",
        "simple_explanation": "Practising investing with pretend money, so you can learn without risk.",
        "example": "You 'buy' 10 shares of a company in a simulator and watch how it does — no real cash involved.",
        "why_it_matters": "It lets you make beginner mistakes for free and learn from them.",
    },
    {
        "term": "Cost basis",
        "simple_explanation": "The average price you paid for your shares.",
        "example": "You bought 10 shares at $100 and 10 more at $120 — your cost basis is $110 per share.",
        "why_it_matters": "Comparing today's price with your cost basis tells you whether you're up or down on a position.",
    },
    {
        "term": "Outcome bias",
        "simple_explanation": "Judging a decision only by how it turned out, instead of by how good the reasoning was at the time.",
        "example": "You buy a stock on a hunch and it rises — it feels like a smart decision, but the reasoning wasn't good, you were just lucky.",
        "why_it_matters": "Learning from your reasoning (not just results) is how you actually get better at investing.",
    },

]


def seed_glossary(db: Session) -> dict:
    added = 0
    for entry in TERMS:
        exists = db.query(GlossaryTerm).filter(GlossaryTerm.term == entry["term"]).first()
        if exists:
            continue
        db.add(GlossaryTerm(**entry))
        added += 1
    db.commit()
    return {"added": added, "already_present": len(TERMS) - added}


if __name__ == "__main__":
    from app.core.db import SessionLocal

    session = SessionLocal()
    try:
        print(seed_glossary(session))
    finally:
        session.close()
