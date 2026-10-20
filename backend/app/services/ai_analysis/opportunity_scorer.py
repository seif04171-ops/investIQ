"""
Phase 5: AI opportunity analysis. Produces a hedged, structured opinion —
never a recommendation. The schema (AIAnalysis model) has no field for
"action to take", which is a deliberate structural guardrail on top of
the prompt-level rules: even if a future prompt tweak slipped, there's
nowhere in the data model for a buy/sell verdict to go.
"""
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.news import AIAnalysis, Event, EventEntity
from app.services.ai_analysis.claude_client import ask_for_json

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "opportunity_analysis.md"
SYSTEM_PROMPT = PROMPT_PATH.read_text()


def analyze_event(db: Session, event: Event) -> None:
    entities = db.query(EventEntity).filter(EventEntity.event_id == event.id).all()
    entity_lines = "\n".join(
        f"- {e.entity_type}: {e.entity_value} (predicted effect: {e.predicted_effect})"
        for e in entities
    )
    user_prompt = f"Event: {event.title}\nSummary: {event.summary}\n\nAffected entities:\n{entity_lines}"

    try:
        result = ask_for_json(system_prompt=SYSTEM_PROMPT, user_prompt=user_prompt)
    except ValueError:
        logger.warning("Skipping analysis for event %s — invalid model JSON", event.id)
        return

    analysis = AIAnalysis(
        event_id=event.id,
        opportunity_score=result.get("opportunity_score"),
        confidence_score=result.get("confidence_score"),
        reasoning_positive=result.get("reasoning_positive", []),
        reasoning_negative=result.get("reasoning_negative", []),
        reasoning_unknown=result.get("reasoning_unknown", []),
        short_term_view=result.get("short_term_view"),
        long_term_view=result.get("long_term_view"),
        risks=result.get("risks", []),
        model_version=settings.AI_MODEL,
    )
    db.add(analysis)
    db.commit()


def run_opportunity_analysis_cycle(db: Session, limit: int = 20) -> dict:
    # Only analyze events that have been summarized + credibility-scored already
    events = (
        db.query(Event)
        .filter(Event.summary.isnot(None))
        .filter(Event.credibility_score.isnot(None))
        .filter(~Event.analyses.any())
        .limit(limit)
        .all()
    )
    for event in events:
        analyze_event(db, event)
    return {"processed": len(events)}
