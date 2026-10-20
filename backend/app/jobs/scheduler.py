"""
Background scheduler for periodic news ingestion.

MVP uses APScheduler in-process (simplest possible setup — one extra
thread inside the FastAPI process, no separate worker to deploy).
If ingestion volume grows past what a single process comfortably
handles, swap this for Celery beat + workers without changing
`ingestion_service.py` at all — that module has no scheduler-specific code.
"""
import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import settings
from app.jobs.tasks import run_full_pipeline

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def _scheduled_pipeline_job():
    try:
        run_full_pipeline(lookback_minutes=settings.NEWS_POLL_INTERVAL_MINUTES)
    except Exception:
        logger.exception("Scheduled pipeline cycle failed")


def _live_news_job():
    from app.services import news_live
    news_live.start_refresh(force=False)


def start_scheduler():
    scheduler.add_job(_live_news_job, "interval", minutes=10, id="live_news", replace_existing=True)
    scheduler.add_job(
        _scheduled_pipeline_job,
        "interval",
        minutes=settings.NEWS_POLL_INTERVAL_MINUTES,
        id="news_pipeline",
        replace_existing=True,
        next_run_time=None,  # first run waits one interval; trigger manually via /news/ingest for immediate test
    )
    scheduler.start()
    logger.info(
        "Full news pipeline scheduler started (every %s min)",
        settings.NEWS_POLL_INTERVAL_MINUTES,
    )


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
