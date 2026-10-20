"""
Turns a company name from a news story ("Apple", "Nvidia Corp") into a real
ticker. Matching is deliberately strict: a search hit is only accepted when
its name actually matches the entity, so we never attach the wrong stock to
a headline.
"""
import threading
import time

from sqlalchemy.orm import Session

from app.models.news import Company
from app.services import market_data
from app.services.event_matching import entity_matches_company, normalize_name

TTL = 24 * 3600

_lock = threading.Lock()
_cache: dict[str, tuple[float, dict | None]] = {}


def pretty_name(name: str) -> str:
    """Finnhub returns names like 'BOEING CO/THE' — make them readable."""
    if name and name.isupper():
        name = name.title().replace("Co/The", "Co").replace("/The", "")
    return name


def clear_cache() -> None:
    with _lock:
        _cache.clear()


def _cache_lookup(key: str):
    with _lock:
        hit = _cache.get(key)
    if hit and time.time() - hit[0] < TTL:
        return True, hit[1]
    return False, None


def resolve_cached(db: Session, name: str) -> dict | None:
    """No network: memory cache, then companies we already know."""
    key = normalize_name(name)
    if not key:
        return None
    found, value = _cache_lookup(key)
    if found:
        return value
    matches = [c for c in db.query(Company).filter(Company.ticker.isnot(None)).all()
               if entity_matches_company(name, c.name, c.ticker)]
    if not matches:
        return None
    best = next((c for c in matches if normalize_name(c.name) == key), matches[0])
    return {"ticker": best.ticker.upper(), "name": pretty_name(best.name)}


def resolve_network(name: str) -> dict | None:
    """Look the name up via Finnhub search. Safe to call from worker threads (no DB)."""
    key = normalize_name(name)
    if not key:
        return None
    found, value = _cache_lookup(key)
    if found:
        return value
    try:
        results = market_data.search_symbol(name)
    except Exception:
        return None  # transient failure: don't cache, try again later
    plain = [r for r in results
             if (r.get("symbol") or "") and "." not in r["symbol"] and r.get("type") == "Common Stock"]
    matching = [r for r in plain if entity_matches_company(name, r.get("description") or "", r["symbol"])]
    # An exact name match beats a looser one ("Apple" -> Apple Inc, not Apple Hospitality REIT).
    pick = next((r for r in matching if normalize_name(r.get("description") or "") == key), matching[0] if matching else None)
    chosen = {"ticker": pick["symbol"].upper(), "name": pretty_name(pick.get("description") or pick["symbol"])} if pick else None
    with _lock:
        _cache[key] = (time.time(), chosen)
    return chosen


def resolve(db: Session, name: str) -> dict | None:
    return resolve_cached(db, name) or resolve_network(name)
