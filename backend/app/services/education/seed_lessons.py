"""
Seed data for lessons — the beginner roadmap from the product brief.
Run via `python -m app.services.education.seed_lessons`.
"""
from sqlalchemy.orm import Session

from app.models.user_data import Lesson

LESSONS = [
    {
        "title": "What is a stock?",
        "difficulty": "beginner",
        "content": (
            "A stock is a small piece of ownership in a company. When you buy a share, "
            "you own a tiny fraction of that business — if it does well, your share "
            "may become more valuable; if it struggles, it may be worth less. "
            "Companies sell shares to raise money for growth, and in exchange, "
            "shareholders get a claim on future profits and sometimes a vote in "
            "company decisions."
        ),
    },
    {
        "title": "How markets work",
        "difficulty": "beginner",
        "content": (
            "A stock market is where buyers and sellers meet to trade shares. Prices "
            "move constantly based on supply and demand — if more people want to buy "
            "a stock than sell it, the price rises, and vice versa. News, earnings "
            "reports, interest rates, and broader economic conditions all shift how "
            "much buyers are willing to pay."
        ),
    },
    {
        "title": "Risk and diversification",
        "difficulty": "beginner",
        "content": (
            "Every investment carries risk — the chance you could lose money. "
            "Diversification means spreading your money across different companies, "
            "industries, or asset types so that one bad outcome doesn't sink your "
            "whole portfolio. It doesn't eliminate risk, but it reduces how much any "
            "single event can hurt you."
        ),
    },
    {
        "title": "Understanding financial news",
        "difficulty": "beginner",
        "content": (
            "Financial news often reports on events — earnings, interest rate "
            "decisions, geopolitical developments — and speculates on how markets "
            "might react. It's useful for understanding context, but no article can "
            "reliably predict what a stock will do next. Reading critically means "
            "asking: what actually happened, and what's speculation about what might "
            "happen?"
        ),
    },
    {
        "title": "Company fundamentals",
        "difficulty": "intermediate",
        "content": (
            "Fundamentals are the underlying financial health of a company: revenue, "
            "profit margins, debt levels, and growth trends. Investors look at these "
            "to judge whether a company's stock price reflects its actual business "
            "performance, or whether it might be over- or under-valued relative to "
            "how it's actually doing."
        ),
    },
    {
        "title": "Building a portfolio",
        "difficulty": "intermediate",
        "content": (
            "A portfolio is your full collection of investments. Building one "
            "thoughtfully means considering your goals, how much risk you're "
            "comfortable with, and how long you plan to invest for — then choosing a "
            "mix of assets that fits those constraints, rather than chasing whatever "
            "is currently popular."
        ),
    },
    {
        "title": "How to read a stock page",
        "difficulty": "beginner",
        "content": (
            "A stock page packs a lot into a small space. The big number is the current price. "
            "The chart shows how that price has moved, and changing the time range (a month vs a year) "
            "can tell very different stories. Market capitalization is the total value of the company's "
            "shares, a quick way to see how big it is. The P/E ratio compares the price to the company's "
            "profit, and the 52-week range shows the highest and lowest prices over the past year, so you "
            "can see where today's price sits. None of these numbers tells you what will happen next — "
            "they help you understand what you're looking at."
        ),
    },
    {
        "title": "Why prices move",
        "difficulty": "beginner",
        "content": (
            "Prices move when buyers and sellers disagree about what a company is worth. New information "
            "— earnings, a product launch, a change in interest rates, a headline from the other side of "
            "the world — makes people update their view, and the price adjusts. Often the market has "
            "already priced in what everyone expected, so a 'good' result can still make a stock fall if "
            "people hoped for better. That's why the same news can move two companies in opposite directions."
        ),
    },
    {
        "title": "Thinking in decisions, not outcomes",
        "difficulty": "intermediate",
        "content": (
            "Investing involves luck, so a good decision can lose money and a poor one can win. "
            "Judging yourself only by results is called outcome bias, and it teaches the wrong lessons. "
            "A better habit is to write down why you made each decision before you know how it turns out, "
            "then review the reasoning later. That's what the Decision Journal in the simulator is for: "
            "over time you learn which kinds of reasons hold up and which don't."
        ),
    },

    {
        "title": "Reading an earnings report",
        "difficulty": "intermediate",
        "content": (
            "Earnings move stocks because they update the market's expectations. Start with three numbers: "
            "revenue, EPS (earnings per share) and guidance (the company's own forecast for the next quarter or year). "
            "What matters is the result versus consensus expectations, not the result in isolation: a company can grow "
            "20% and still fall if analysts expected 25%.\n\n"
            "Then read the quality of the beat. Was revenue growth organic, or did buybacks and one-off gains lift EPS? "
            "Did margins expand? Did cash flow match reported profit? Guidance is usually the biggest mover: a beat with "
            "lowered guidance often sells off, a miss with raised guidance often rallies.\n\n"
            "Expect volatility. Options markets price an expected earnings move in advance, so the surprise relative "
            "to that implied move is what matters for the reaction."
        ),
    },
    {
        "title": "Valuation: P/E, EV/EBITDA and PEG",
        "difficulty": "intermediate",
        "content": (
            "Valuation multiples compare price to what a business earns. P/E (price / earnings per share) is the "
            "simplest: a P/E of 30 means you pay $30 for each $1 of yearly profit. High P/Es can be justified by fast "
            "growth; low P/Es can be value traps if profits are about to fall.\n\n"
            "EV/EBITDA compares enterprise value (market cap plus debt minus cash) to operating profit before "
            "depreciation, which makes companies with different debt levels comparable. PEG divides P/E by expected "
            "earnings growth, so a PEG near or below 1 suggests you are not overpaying for growth.\n\n"
            "Always compare within the same sector and against the company's own history. A 25 P/E is expensive for a bank and cheap for "
            "high-growth software. Multiples also move with interest rates: when rates rise, future profits are "
            "discounted more, and high-multiple stocks usually fall hardest."
        ),
    },
    {
        "title": "Position sizing and risk per trade",
        "difficulty": "intermediate",
        "content": (
            "How much you put into an idea matters as much as which idea. A common rule is to risk a small fixed "
            "share of the portfolio (often 0.5–2%) on any single position: if you size a stock at 10% of your portfolio and it "
            "falls 20%, you lose 2% overall.\n\n"
            "Decide your exit before you enter: the price or the condition (a thesis broken by new facts) at which you "
            "would be wrong. Sizing from that point backwards keeps one bad call from dominating your results.\n\n"
            "Watch correlation. Five tech stocks are closer to one big tech position than five independent bets, "
            "because they tend to fall together. The Portfolio Health score in this app flags exactly this kind of concentration."
        ),
    },
    {
        "title": "Rates, yields and what they do to stocks",
        "difficulty": "advanced",
        "content": (
            "Interest rates are the gravity of markets. Higher rates raise the return available on safe bonds and increase "
            "the discount rate applied to future profits, which compresses valuations, especially for long-duration "
            "growth stocks whose profits are far in the future. Lower rates do the reverse.\n\n"
            "Watch the 10-year Treasury yield and, more importantly, expectations for central-bank decisions rather than "
            "decisions themselves: markets move on surprises versus what was priced in. A rate cut that was fully expected "
            "can leave stocks flat, while a hold when a cut was expected can sell off.\n\n"
            "Sensitivity differs by sector: banks can benefit from higher rates (wider lending margins) until credit losses "
            "rise, real estate and utilities (bond proxies) tend to suffer, and heavily indebted companies face higher refinancing costs."
        ),
    },
    {
        "title": "Reading price action: trend, range and volume",
        "difficulty": "advanced",
        "content": (
            "Price action shows how the market is actually responding to information. A stock making higher highs "
            "and higher lows is in an uptrend; the reverse is a downtrend. Where a price sits in its 52-week range "
            "tells you whether you are buying strength or hoping for a rebound.\n\n"
            "Moves on high volume (many more shares than usual) carry more information than moves on thin volume. "
            "A breakout above a prior high on strong volume is more credible than one on weak volume; a sharp drop on heavy volume "
            "after bad news suggests real selling, not noise.\n\n"
            "Treat these as context, not certainty. Momentum can persist, but extended moves also reverse, which is why "
            "the signal radar lists 'already up a lot this month' as a risk rather than as a reason to buy."
        ),
    },
]


def seed_lessons(db: Session) -> dict:
    added = 0
    for entry in LESSONS:
        exists = db.query(Lesson).filter(Lesson.title == entry["title"]).first()
        if exists:
            continue
        db.add(Lesson(**entry))
        added += 1
    db.commit()
    return {"added": added, "already_present": len(LESSONS) - added}


if __name__ == "__main__":
    from app.core.db import SessionLocal

    session = SessionLocal()
    try:
        print(seed_lessons(session))
    finally:
        session.close()
