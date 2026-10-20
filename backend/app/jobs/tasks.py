"""
Runs the full news-to-analysis pipeline in sequence. Each stage only
processes rows the previous stage has already prepared (see each
service's query filters), so calling all of them every cycle is safe
and idempotent — nothing gets double-processed.
"""
import logging

from app.core.db import SessionLocal
from app.services.news_ingestion.ingestion_service import run_ingestion_cycle
from app.services.news_ingestion.event_clustering import run_clustering_cycle
from app.services.ai_analysis.summarizer import run_summarization_cycle
from app.services.ai_analysis.credibility_scorer import run_credibility_scoring_cycle
from app.services.ai_analysis.opportunity_scorer import run_opportunity_analysis_cycle
from app.services.ai_analysis.historical_matcher import run_historical_matching_cycle

logger = logging.getLogger(__name__)


def run_full_pipeline(lookback_minutes: int = 30) -> dict:
    db = SessionLocal()
    results = {}
    try:
        results["ingestion"] = run_ingestion_cycle(db, lookback_minutes=lookback_minutes)
        results["clustering"] = run_clustering_cycle(db)
        results["summarization"] = run_summarization_cycle(db)
        results["credibility"] = run_credibility_scoring_cycle(db)
        results["opportunity_analysis"] = run_opportunity_analysis_cycle(db)
        results["historical_matching"] = run_historical_matching_cycle(db)
    except Exception:
        logger.exception("Pipeline cycle failed partway through")
        raise
    finally:
        db.close()
    return results
