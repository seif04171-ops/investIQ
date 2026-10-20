"""
Matching news-event entities (free-text company names like "Apple" or
"Alphabet Inc.") to the Company rows users hold or watch (ticker + legal
name like "APPLE INC"). Pure functions — no DB, no network — so they're
easy to test. This is what powers "news that affects *your* stocks".
"""
import re

_NOISE = {
    "inc", "incorporated", "corp", "corporation", "co", "company", "ltd", "limited",
    "plc", "llc", "holdings", "holding", "group", "the", "class", "a", "b", "c",
    "ordinary", "shares", "share", "common", "stock", "adr", "ag", "sa", "nv", "se",
}


def _tokens(text: str) -> list[str]:
    cleaned = re.sub(r"[^a-z0-9 ]+", " ", (text or "").lower())
    return [t for t in cleaned.split() if t and t not in _NOISE]


def normalize_name(text: str) -> str:
    return " ".join(_tokens(text))


def entity_matches_company(entity_value: str, company_name: str, ticker: str | None) -> bool:
    """True if a free-text entity plausibly refers to this company."""
    if not entity_value:
        return False
    ent = entity_value.strip()

    # Exact ticker mention ("AAPL"), but never single letters ("A", "F"),
    # which would match half the alphabet.
    if ticker and len(ticker) >= 2 and ent.upper() == ticker.upper():
        return True

    ent_tokens = _tokens(ent)
    name_tokens = _tokens(company_name)
    if not ent_tokens or not name_tokens:
        return False

    if ent_tokens == name_tokens:
        return True

    # "Apple" vs "Apple Inc": the entity is the company's leading token(s).
    # At most one extra word is allowed ("Exxon" ~ "Exxon Mobil"), so "Apple" does not
    # match "Apple Hospitality REIT".
    if (
        len(ent_tokens) <= len(name_tokens)
        and name_tokens[: len(ent_tokens)] == ent_tokens
        and len(name_tokens) - len(ent_tokens) <= 1
    ):
        return len(" ".join(ent_tokens)) >= 3

    # "Alphabet Inc. (Google)" style: the company name is the entity's leading tokens.
    if len(name_tokens) <= len(ent_tokens) and ent_tokens[: len(name_tokens)] == name_tokens:
        return len(" ".join(name_tokens)) >= 3

    return False


def event_matches_company(entity_values: list[str], company_name: str, ticker: str | None) -> bool:
    return any(entity_matches_company(v, company_name, ticker) for v in entity_values)
