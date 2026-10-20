"""
Phase 3: for each event that doesn't yet have an AI-generated summary,
feed its member articles to Claude and populate title/summary/event_type
plus structured EventEntity rows.
"""
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.news import Article, Event, EventArticle, EventEntity, Company
from app.services.ai_analysis.claude_client import ask_for_json

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "summarize_event.md"
SYSTEM_PROMPT = PROMPT_PATH.read_text()


def _get_or_create_company(db: Session, name: str, ticker: str | None) -> Company:
    query = db.query(Company)
    company = (
        query.filter(Company.ticker == ticker).first()
        if ticker
        else query.filter(Company.name == name).first()
    )
    if company:
        return company
    company = Company(name=name, ticker=ticker)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def summarize_event(db: Session, event: Event) -> None:
    """Summarize + extract entities for a single event, in place."""
    articles = (
        db.query(Article)
        .join(EventArticle, EventArticle.article_id == Article.id)
        .filter(EventArticle.event_id == event.id)
        .all()
    )
    if not articles:
        return

    combined_text = "\n\n---\n\n".join(
        f"Title: {a.title}\n{a.raw_text or ''}" for a in articles
    )[:8000]  # keep prompt cost bounded; Claude doesn't need every raw byte

    try:
        result = ask_for_json(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=combined_text,
        )
    except ValueError:
        logger.warning("Skipping event %s — model did not return valid JSON", event.id)
        return

    event.title = result.get("title", event.title)
    event.summary = result.get("summary")
    event.event_type = result.get("event_type", event.event_type)

    for entity in result.get("entities", []):
        company = None
        if entity.get("entity_type") == "company":
            company = _get_or_create_company(
                db, entity["entity_value"], entity.get("ticker")
            )
        db.add(
            EventEntity(
                event_id=event.id,
                entity_type=entity.get("entity_type", "unclear"),
                entity_value=entity.get("entity_value", ""),
                company_id=company.id if company else None,
                predicted_effect=entity.get("predicted_effect", "unclear"),
            )
        )
    db.commit()


def run_summarization_cycle(db: Session, limit: int = 20) -> dict:
    """Summarize a batch of not-yet-summarized events."""
    events = (
        db.query(Event)
        .filter(Event.summary.is_(None))
        .limit(limit)
        .all()
    )
    processed = 0
    for event in events:
        summarize_event(db, event)
        processed += 1
    return {"processed": processed}
