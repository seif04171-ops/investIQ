"""
Phase 9: historical analogue matching.

MVP approach: a small, hand-curated table of well-known historical
patterns (rate cuts, oil shocks, etc.), matched against new events via
embedding similarity between the event summary and each analogue's
description. This is intentionally NOT trying to be a comprehensive
historical database — it's a teaching tool ("here's a past pattern that
rhymes with this"), not a backtesting engine.

The disclaimer is attached at the database level (HistoricalAnalogue.disclaimer
has a default), not just in the prompt — so it can never be silently dropped.
"""
import numpy as np
from sqlalchemy.orm import Session

from app.models.news import Event, HistoricalAnalogue
from app.services.embeddings import get_embedding

# Seed analogues. In production this would grow via curated research,
# not AI generation — historical accuracy here matters more than volume.
SEED_ANALOGUES = [
    {
        "description": "Central bank cuts interest rates amid slowing growth",
        "analogue_year": 2019,
        "avg_market_reaction": "Growth and technology stocks historically outperformed in the months following rate cuts, though results varied by sector and starting valuation.",
        "sectors_affected": ["Technology", "Real Estate", "Consumer Discretionary"],
    },
    {
        "description": "Geopolitical conflict disrupts major oil shipping routes",
        "analogue_year": 2019,
        "avg_market_reaction": "Energy stocks and oil prices rose in the short term; airlines and shipping-dependent industries saw increased costs.",
        "sectors_affected": ["Energy", "Airlines", "Shipping", "Manufacturing"],
    },
    {
        "description": "Major central bank raises interest rates to combat inflation",
        "analogue_year": 2022,
        "avg_market_reaction": "Growth stocks and long-duration assets underperformed; financial sector stocks were mixed depending on the shape of the rate path.",
        "sectors_affected": ["Technology", "Financials", "Real Estate"],
    },
    {
        "description": "Major tech company reports earnings that miss analyst expectations",
        "analogue_year": 2023,
        "avg_market_reaction": "Individual stock often fell sharply short-term; sector-wide effects were typically limited unless the miss reflected a broader industry trend.",
        "sectors_affected": ["Technology"],
    },
]

MATCH_THRESHOLD = 0.75


def seed_historical_analogues_reference() -> list[dict]:
    """
    Returns the reference analogue definitions (not yet tied to any event).
    Matching happens per-event in match_event_to_analogues below.
    """
    return SEED_ANALOGUES


def _cosine_similarity(a, b) -> float:
    a_arr, b_arr = np.array(a), np.array(b)
    denom = np.linalg.norm(a_arr) * np.linalg.norm(b_arr)
    return float(np.dot(a_arr, b_arr) / denom) if denom else 0.0


def match_event_to_analogues(db: Session, event: Event, top_k: int = 2) -> int:
    """Embed the event summary, compare to seed analogue descriptions, attach best matches."""
    if not event.summary:
        return 0

    event_embedding = get_embedding(event.summary)
    scored = []
    for analogue in SEED_ANALOGUES:
        analogue_embedding = get_embedding(analogue["description"])
        score = _cosine_similarity(event_embedding, analogue_embedding)
        scored.append((score, analogue))

    scored.sort(key=lambda x: x[0], reverse=True)
    matched = [a for score, a in scored[:top_k] if score >= MATCH_THRESHOLD]

    for analogue in matched:
        db.add(
            HistoricalAnalogue(
                event_id=event.id,
                analogue_year=analogue["analogue_year"],
                analogue_description=analogue["description"],
                avg_market_reaction=analogue["avg_market_reaction"],
                sectors_affected=analogue["sectors_affected"],
                # disclaimer uses model default: "Historical patterns do not guarantee future results."
            )
        )
    db.commit()
    return len(matched)


def run_historical_matching_cycle(db: Session, limit: int = 20) -> dict:
    events = (
        db.query(Event)
        .filter(Event.summary.isnot(None))
        .filter(~Event.historical_analogues.any())
        .limit(limit)
        .all()
    )
    total_matched = 0
    for event in events:
        total_matched += match_event_to_analogues(db, event)
    return {"events_processed": len(events), "analogues_attached": total_matched}
