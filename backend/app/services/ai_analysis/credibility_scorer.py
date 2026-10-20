"""
Phase 4: credibility scoring.

Deliberately NOT an LLM call — credibility should be a deterministic,
auditable calculation the user can trust and you can explain, not a
black-box AI opinion about trustworthiness. Formula below is a
reasonable MVP starting point; tune the weights once you have real
examples of over/under-scored events.
"""
from sqlalchemy.orm import Session

from app.models.news import Article, Event, EventArticle, Source

# Weights sum to 100. Adjust as you learn what actually predicts accuracy.
# Weights sum to 100. Rebalanced from the original 40/35/25 split — the
# old confirmations curve gave a single source only 25% credit (35*0.25=8.75),
# capping even a top-tier outlet (Reuters, 95 reputation) at ~48/100 alone.
# That over-penalized single-source stories regardless of how good the
# source was. Now: source reputation carries more weight, and a lone
# source gets a reasonable baseline (55%) rather than a steep floor —
# corroboration still matters and still raises the score, just doesn't
# dominate it the way it did before.
WEIGHT_SOURCE_REPUTATION = 55
WEIGHT_INDEPENDENT_CONFIRMATIONS = 30
WEIGHT_OFFICIAL_CONFIRMATION = 15

OFFICIAL_SOURCE_TYPES = {"government", "central_bank", "company_filing"}


def _source_reputation_component(sources: list[Source]) -> float:
    """Average of each distinct source's base_reliability_score, scaled to the weight."""
    scored = [s.base_reliability_score for s in sources if s.base_reliability_score is not None]
    if not scored:
        return WEIGHT_SOURCE_REPUTATION * 0.5  # neutral default when sources are unrated
    avg = sum(scored) / len(scored)
    return WEIGHT_SOURCE_REPUTATION * (avg / 100)


def _independent_confirmations_component(sources: list[Source]) -> float:
    """
    More distinct outlets reporting the same event = higher confidence.
    A single source now gets 55% baseline credit (not 25%) — corroboration
    still matters and still increases the score, but a lone decent source
    isn't punished as if it were inherently unreliable.
    """
    distinct_count = len(set(s.id for s in sources))
    if distinct_count == 0:
        return 0.0
    ratio = min(0.4 + distinct_count * 0.15, 1.0)
    return WEIGHT_INDEPENDENT_CONFIRMATIONS * ratio


def _official_confirmation_component(sources: list[Source]) -> float:
    has_official = any(s.type in OFFICIAL_SOURCE_TYPES for s in sources)
    return WEIGHT_OFFICIAL_CONFIRMATION if has_official else 0.0


def score_event(db: Session, event: Event) -> None:
    articles = (
        db.query(Article)
        .join(EventArticle, EventArticle.article_id == Article.id)
        .filter(EventArticle.event_id == event.id)
        .all()
    )
    source_ids = {a.source_id for a in articles if a.source_id}
    sources = db.query(Source).filter(Source.id.in_(source_ids)).all() if source_ids else []

    reputation = _source_reputation_component(sources)
    confirmations = _independent_confirmations_component(sources)
    official = _official_confirmation_component(sources)

    total = round(reputation + confirmations + official)
    event.credibility_score = min(total, 100)
    event.credibility_breakdown = {
        "source_reputation": round(reputation, 1),
        "independent_confirmations": round(confirmations, 1),
        "official_confirmation": round(official, 1),
        "distinct_source_count": len(set(s.id for s in sources)),
    }
    db.commit()


def run_credibility_scoring_cycle(db: Session, limit: int = 50) -> dict:
    events = (
        db.query(Event)
        .filter(Event.credibility_score.is_(None))
        .filter(Event.summary.isnot(None))  # only score events Phase 3 has already summarized
        .limit(limit)
        .all()
    )
    for event in events:
        score_event(db, event)
    return {"processed": len(events)}
