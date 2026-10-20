"""
Analysis router — the "event detail" endpoint that ties together
Phases 3-5 (and 9 once built): summary, entities, credibility, AI opinion.
This is what powers the frontend's news/[eventId] page.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.news import Event, EventEntity, AIAnalysis, HistoricalAnalogue, Article, EventArticle, Source, Company
from app.services.event_matching import event_matches_company
from app.services import ticker_resolver

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/ping")
def ping():
    return {"status": "ok", "router": "analysis"}


def _derive_sentiment(entities: list[EventEntity]) -> str:
    """Simple majority vote across entity predicted_effect — good enough
    for a feed-level badge; the event detail page shows the full breakdown."""
    if not entities:
        return "unclear"
    counts: dict[str, int] = {}
    for e in entities:
        counts[e.predicted_effect] = counts.get(e.predicted_effect, 0) + 1
    return max(counts, key=counts.get)


def _get_source_links(db: Session, event_id) -> list[dict]:
    """Real article URLs backing this event — lets the frontend link
    straight to the original reporting instead of only showing our summary."""
    rows = (
        db.query(Article.url, Source.name)
        .join(EventArticle, EventArticle.article_id == Article.id)
        .join(Source, Source.id == Article.source_id)
        .filter(EventArticle.event_id == event_id)
        .all()
    )
    return [{"source_name": name, "url": url} for url, name in rows if url]


def _stock_links(db: Session, entities: list[EventEntity], network: bool = False) -> list[dict]:
    """Company entities resolved to real tickers (no network unless asked — keeps feeds fast)."""
    out: dict[str, dict] = {}
    for ent in entities:
        if ent.entity_type != "company":
            continue
        info = (ticker_resolver.resolve(db, ent.entity_value) if network
                else ticker_resolver.resolve_cached(db, ent.entity_value))
        if info and info["ticker"] not in out:
            out[info["ticker"]] = {"ticker": info["ticker"], "name": info["name"], "effect": ent.predicted_effect or "unclear"}
    return list(out.values())


def serialize_event_summary(db: Session, e: Event) -> dict:
    """Feed-shape dict for one event (shared by /analysis/events and /briefing)."""
    entities = db.query(EventEntity).filter(EventEntity.event_id == e.id).all()
    companies = [ent.entity_value for ent in entities if ent.entity_type == "company"]
    sectors = [ent.entity_value for ent in entities if ent.entity_type in ("sector", "industry")]
    sources = _get_source_links(db, e.id)
    return {
        "id": str(e.id),
        "title": e.title,
        "summary": e.summary,
        "event_type": e.event_type,
        "credibility_score": e.credibility_score,
        "sentiment": _derive_sentiment(entities),
        "companies": companies,
        "sectors": sectors,
        "last_updated_at": e.last_updated_at.isoformat() if e.last_updated_at else None,
        "source_url": sources[0]["url"] if sources else None,
        "source_name": sources[0]["source_name"] if sources else None,
        "source_count": len(sources),
        "tickers": _stock_links(db, entities),
    }


@router.get("/events")
def list_events(limit: int = 20, ticker: str | None = None, db: Session = Depends(get_db)):
    """
    Feed of clustered, summarized events. With ?ticker=AAPL, only events that
    mention that company (matched by name or ticker) are returned.
    """
    limit = max(1, min(limit, 100))
    query = (
        db.query(Event)
        .filter(Event.summary.isnot(None))
        .order_by(Event.last_updated_at.desc())
    )

    if ticker:
        company = db.query(Company).filter(Company.ticker == ticker.upper().strip()).first()
        if not company:
            return []
        result = []
        for e in query.limit(150).all():
            item = serialize_event_summary(db, e)
            if event_matches_company(item["companies"], company.name, company.ticker):
                result.append(item)
                if len(result) >= limit:
                    break
        return result

    return [serialize_event_summary(db, e) for e in query.limit(limit).all()]


@router.get("/events/{event_id}")
def get_event_detail(event_id: str, db: Session = Depends(get_db)):
    """Full detail for one event: entities, credibility breakdown, AI analysis, historical analogues."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    entities = db.query(EventEntity).filter(EventEntity.event_id == event.id).all()
    analysis = (
        db.query(AIAnalysis)
        .filter(AIAnalysis.event_id == event.id)
        .order_by(AIAnalysis.generated_at.desc())
        .first()
    )
    analogues = db.query(HistoricalAnalogue).filter(HistoricalAnalogue.event_id == event.id).all()
    sources = _get_source_links(db, event.id)

    return {
        "id": str(event.id),
        "title": event.title,
        "last_updated_at": event.last_updated_at.isoformat() if event.last_updated_at else None,
        "summary": event.summary,
        "event_type": event.event_type,
        "credibility_score": event.credibility_score,
        "credibility_breakdown": event.credibility_breakdown,
        "sources": sources,
        "related_stocks": _stock_links(db, entities, network=True),
        "entities": [
            {
                "entity_type": ent.entity_type,
                "entity_value": ent.entity_value,
                "predicted_effect": ent.predicted_effect,
            }
            for ent in entities
        ],
        "ai_analysis": (
            {
                "opportunity_score": analysis.opportunity_score,
                "confidence_score": analysis.confidence_score,
                "reasoning_positive": analysis.reasoning_positive,
                "reasoning_negative": analysis.reasoning_negative,
                "reasoning_unknown": analysis.reasoning_unknown,
                "short_term_view": analysis.short_term_view,
                "long_term_view": analysis.long_term_view,
                "risks": analysis.risks,
            }
            if analysis
            else None
        ),
        "historical_analogues": [
            {
                "year": a.analogue_year,
                "description": a.analogue_description,
                "avg_market_reaction": a.avg_market_reaction,
                "sectors_affected": a.sectors_affected,
                "disclaimer": a.disclaimer,
            }
            for a in analogues
        ],
    }
