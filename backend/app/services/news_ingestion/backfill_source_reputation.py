"""
One-time backfill: re-scores every existing Source using the reputation
lookup table, then recomputes credibility_score for every existing Event.

Needed because the reputation fix only affects *newly created* Source
rows going forward — anything ingested before this fix has
base_reliability_score stuck at whatever it was set to before (None, or
the old flat default), which is exactly why credibility looked frozen at
one number regardless of the actual source.

Run once via:
    python -m app.services.news_ingestion.backfill_source_reputation
"""
from app.core.db import SessionLocal
from app.models.news import Source, Event
from app.services.news_ingestion.source_reputation import get_source_reputation
from app.services.ai_analysis.credibility_scorer import score_event


def backfill():
    db = SessionLocal()
    try:
        sources = db.query(Source).all()
        updated_sources = 0
        for source in sources:
            new_score = get_source_reputation(source.name)
            if source.base_reliability_score != new_score:
                source.base_reliability_score = new_score
                updated_sources += 1
        db.commit()

        events = db.query(Event).filter(Event.summary.isnot(None)).all()
        for event in events:
            score_event(db, event)

        return {"sources_updated": updated_sources, "events_rescored": len(events)}
    finally:
        db.close()


if __name__ == "__main__":
    print(backfill())
