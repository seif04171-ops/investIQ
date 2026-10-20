"""
The curated set of widely-followed stocks InvestIQ scans, suggests and links
news to. Hand-picked for liquidity and name recognition so the radar and the
Explore page always have something real to show, with or without a watchlist.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Stock:
    ticker: str
    name: str
    sector: str
    category: str
    aliases: tuple[str, ...] = field(default=())  # distinctive lowercase names found in headlines


CATEGORIES: list[tuple[str, str]] = [
    ("megacap", "Mega-cap tech"),
    ("ai", "AI & semiconductors"),
    ("financials", "Financials"),
    ("healthcare", "Healthcare"),
    ("energy", "Energy"),
    ("consumer", "Consumer"),
    ("industrials", "Industrials & autos"),
    ("growth", "Growth & trending"),
    ("etf", "Popular ETFs"),
]


def _s(ticker, name, sector, category, *aliases):
    return Stock(ticker, name, sector, category, tuple(a.lower() for a in aliases))


STOCKS: list[Stock] = [
    # Mega-cap tech
    _s("AAPL", "Apple", "Technology", "megacap", "apple inc", "iphone maker"),
    _s("MSFT", "Microsoft", "Technology", "megacap", "microsoft"),
    _s("GOOGL", "Alphabet (Google)", "Communication", "megacap", "alphabet", "google"),
    _s("AMZN", "Amazon", "Consumer", "megacap", "amazon"),
    _s("META", "Meta Platforms", "Communication", "megacap", "meta platforms", "facebook", "instagram parent"),
    _s("NFLX", "Netflix", "Communication", "megacap", "netflix"),
    _s("TSLA", "Tesla", "Autos", "megacap", "tesla"),
    _s("ORCL", "Oracle", "Technology", "megacap", "oracle"),
    _s("CRM", "Salesforce", "Technology", "megacap", "salesforce"),
    _s("ADBE", "Adobe", "Technology", "megacap", "adobe"),
    # AI & semiconductors
    _s("NVDA", "Nvidia", "Semiconductors", "ai", "nvidia"),
    _s("AMD", "AMD", "Semiconductors", "ai", "advanced micro devices"),
    _s("AVGO", "Broadcom", "Semiconductors", "ai", "broadcom"),
    _s("TSM", "Taiwan Semiconductor", "Semiconductors", "ai", "taiwan semiconductor", "tsmc"),
    _s("INTC", "Intel", "Semiconductors", "ai", "intel corp", "intel's", "intel stock"),
    _s("MU", "Micron", "Semiconductors", "ai", "micron technology", "micron"),
    _s("QCOM", "Qualcomm", "Semiconductors", "ai", "qualcomm"),
    _s("ASML", "ASML", "Semiconductors", "ai", "asml"),
    _s("PLTR", "Palantir", "Technology", "ai", "palantir"),
    _s("SMCI", "Super Micro Computer", "Technology", "ai", "super micro"),
    # Financials
    _s("JPM", "JPMorgan Chase", "Financials", "financials", "jpmorgan", "jp morgan"),
    _s("BAC", "Bank of America", "Financials", "financials", "bank of america"),
    _s("GS", "Goldman Sachs", "Financials", "financials", "goldman sachs"),
    _s("MS", "Morgan Stanley", "Financials", "financials", "morgan stanley"),
    _s("WFC", "Wells Fargo", "Financials", "financials", "wells fargo"),
    _s("V", "Visa", "Financials", "financials", "visa inc", "visa's"),
    _s("MA", "Mastercard", "Financials", "financials", "mastercard"),
    _s("PYPL", "PayPal", "Financials", "financials", "paypal"),
    _s("COIN", "Coinbase", "Financials", "financials", "coinbase"),
    # Healthcare
    _s("LLY", "Eli Lilly", "Healthcare", "healthcare", "eli lilly", "lilly"),
    _s("NVO", "Novo Nordisk", "Healthcare", "healthcare", "novo nordisk"),
    _s("UNH", "UnitedHealth", "Healthcare", "healthcare", "unitedhealth"),
    _s("JNJ", "Johnson & Johnson", "Healthcare", "healthcare", "johnson & johnson", "j&j"),
    _s("PFE", "Pfizer", "Healthcare", "healthcare", "pfizer"),
    _s("MRK", "Merck", "Healthcare", "healthcare", "merck"),
    _s("ABBV", "AbbVie", "Healthcare", "healthcare", "abbvie"),
    _s("TMO", "Thermo Fisher", "Healthcare", "healthcare", "thermo fisher"),
    _s("MRNA", "Moderna", "Healthcare", "healthcare", "moderna"),
    # Energy
    _s("XOM", "Exxon Mobil", "Energy", "energy", "exxon"),
    _s("CVX", "Chevron", "Energy", "energy", "chevron"),
    _s("COP", "ConocoPhillips", "Energy", "energy", "conocophillips"),
    _s("OXY", "Occidental Petroleum", "Energy", "energy", "occidental"),
    _s("SLB", "Schlumberger", "Energy", "energy", "schlumberger"),
    # Consumer
    _s("WMT", "Walmart", "Consumer", "consumer", "walmart"),
    _s("COST", "Costco", "Consumer", "consumer", "costco"),
    _s("KO", "Coca-Cola", "Consumer", "consumer", "coca-cola", "coca cola"),
    _s("PEP", "PepsiCo", "Consumer", "consumer", "pepsico", "pepsi"),
    _s("MCD", "McDonald's", "Consumer", "consumer", "mcdonald's", "mcdonalds"),
    _s("NKE", "Nike", "Consumer", "consumer", "nike"),
    _s("SBUX", "Starbucks", "Consumer", "consumer", "starbucks"),
    _s("DIS", "Disney", "Communication", "consumer", "walt disney", "disney"),
    _s("HD", "Home Depot", "Consumer", "consumer", "home depot"),
    _s("UBER", "Uber", "Technology", "consumer", "uber technologies", "uber's", "uber stock"),
    _s("ABNB", "Airbnb", "Consumer", "consumer", "airbnb"),
    # Industrials & autos
    _s("BA", "Boeing", "Industrials", "industrials", "boeing"),
    _s("CAT", "Caterpillar", "Industrials", "industrials", "caterpillar"),
    _s("GE", "GE Aerospace", "Industrials", "industrials", "ge aerospace"),
    _s("LMT", "Lockheed Martin", "Industrials", "industrials", "lockheed"),
    _s("RTX", "RTX (Raytheon)", "Industrials", "industrials", "raytheon", "rtx corp"),
    _s("DE", "Deere", "Industrials", "industrials", "deere"),
    _s("UPS", "UPS", "Industrials", "industrials", "united parcel service"),
    _s("F", "Ford", "Autos", "industrials", "ford motor"),
    _s("GM", "General Motors", "Autos", "industrials", "general motors"),
    # Growth & trending
    _s("SOFI", "SoFi", "Financials", "growth", "sofi"),
    _s("HOOD", "Robinhood", "Financials", "growth", "robinhood"),
    _s("RIVN", "Rivian", "Autos", "growth", "rivian"),
    _s("SNOW", "Snowflake", "Technology", "growth", "snowflake"),
    _s("SHOP", "Shopify", "Technology", "growth", "shopify"),
    _s("CRWD", "CrowdStrike", "Technology", "growth", "crowdstrike"),
    _s("PANW", "Palo Alto Networks", "Technology", "growth", "palo alto networks"),
    _s("NET", "Cloudflare", "Technology", "growth", "cloudflare"),
    _s("APP", "AppLovin", "Technology", "growth", "applovin"),
    _s("RDDT", "Reddit", "Communication", "growth", "reddit"),
    _s("RBLX", "Roblox", "Communication", "growth", "roblox"),
    _s("DKNG", "DraftKings", "Consumer", "growth", "draftkings"),
    # ETFs
    _s("SPY", "S&P 500 ETF", "ETF", "etf"),
    _s("QQQ", "Nasdaq 100 ETF", "ETF", "etf"),
    _s("DIA", "Dow Jones ETF", "ETF", "etf"),
    _s("IWM", "Russell 2000 ETF", "ETF", "etf"),
    _s("VOO", "Vanguard S&P 500", "ETF", "etf"),
    _s("VTI", "Vanguard Total Market", "ETF", "etf"),
    _s("XLK", "Technology Sector ETF", "ETF", "etf"),
    _s("XLF", "Financial Sector ETF", "ETF", "etf"),
    _s("XLE", "Energy Sector ETF", "ETF", "etf"),
    _s("ARKK", "ARK Innovation ETF", "ETF", "etf"),
    _s("GLD", "Gold ETF", "ETF", "etf"),
    _s("TLT", "20+ Year Treasury ETF", "ETF", "etf"),
]

BY_TICKER: dict[str, Stock] = {s.ticker: s for s in STOCKS}
TICKERS: list[str] = [s.ticker for s in STOCKS]
SCAN_TICKERS: list[str] = [s.ticker for s in STOCKS if s.category != "etf"]  # stocks only, for the radar

# Tickers too short / too common as words to trust on their own in a headline.
_AMBIGUOUS = {"V", "MA", "F", "GE", "MS", "DE", "CAT", "COP", "UPS", "HD", "KO", "BA", "GM", "GS", "MU", "NET", "APP", "AMD"}
_EXCHANGE_TAG = re.compile(r"\b(?:NASDAQ|NYSE|NYSEARCA|AMEX|NYSEAMERICAN)\s*[:\-]\s*([A-Z]{1,5})\b")
_CASHTAG = re.compile(r"\$([A-Z]{1,5})\b")
_ALIAS_INDEX: list[tuple[re.Pattern, str]] = []
_UPPER_TICKERS = {t for t in TICKERS if t not in _AMBIGUOUS and len(t) >= 3}


def _build_alias_index() -> None:
    for s in STOCKS:
        for alias in s.aliases:
            _ALIAS_INDEX.append((re.compile(rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])"), s.ticker))


_build_alias_index()


def find_tickers_in_text(text: str) -> list[str]:
    """Universe tickers a headline/summary clearly refers to (order of first appearance)."""
    if not text:
        return []
    found: list[str] = []

    def add(t: str):
        if t in BY_TICKER and t not in found:
            found.append(t)

    for m in _EXCHANGE_TAG.finditer(text):
        add(m.group(1))
    for m in _CASHTAG.finditer(text):
        add(m.group(1))
    low = text.lower()
    for pattern, ticker in _ALIAS_INDEX:
        if pattern.search(low):
            add(ticker)
    for word in re.findall(r"\b[A-Z]{3,5}\b", text):
        if word in _UPPER_TICKERS:
            add(word)
    return found


def name_for(ticker: str) -> str:
    s = BY_TICKER.get(ticker.upper())
    return s.name if s else ticker.upper()
