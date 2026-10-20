"""
Run the news pipeline on demand, in the background.

The scheduler keeps news flowing every few minutes; this lets the UI (and app
start-up) ask for a refresh *right now*. Only one run happens at a time, and a
second request right after a run just reports the status instead of
hammering the news APIs.
"""
import logging
import threading
import time

from app.core.db import SessionLocal
from app.models.news import Article, Event

logger = logging.getLogger(__name__)

MIN_GAP_SECONDS = 45

_lock = threading.Lock()
_state: dict = {
    "running": False,
    "started_at": None,
    "finished_at": None,
    "error": None,
    "new_articles": 0,
    "new_events": 0,
}


def status() -> dict:
    with _lock:
        return dict(_state)


def _counts() -> tuple[int, int]:
    db = SessionLocal()
    try:
        return db.query(Article).count(), db.query(Event).count()
    finally:
        db.close()


def _run(lookback_minutes: int) -> None:
    from app.jobs.tasks import run_full_pipeline  # imported lazily: heavy AI clients

    error = None
    new_articles = new_events = 0
    try:
        a0, e0 = _counts()
        run_full_pipeline(lookback_minutes=lookback_minutes)
        a1, e1 = _counts()
        new_articles, new_events = max(0, a1 - a0), max(0, e1 - e0)
    except Exception as exc:  # surfaced to the UI instead of failing silently
        logger.exception("On-demand pipeline run failed")
        error = f"{type(exc).__name__}: {exc}"[:300]
    finally:
        try:
            from app.services import opportunities

            opportunities.clear_cache()
        except Exception:
            pass
        with _lock:
            _state.update(
                running=False,
                finished_at=time.time(),
                error=error,
                new_articles=new_articles,
                new_events=new_events,
            )


def start_refresh(lookback_minutes: int = 180, force: bool = False) -> dict:
    """Kick off a background refresh. Returns the current status either way."""
    with _lock:
        if _state["running"]:
            return {**_state, "started": False}
        recent = _state["finished_at"] and time.time() - _state["finished_at"] < MIN_GAP_SECONDS
        if recent and not force:
            return {**_state, "started": False}
        _state.update(running=True, started_at=time.time(), error=None)
    threading.Thread(target=_run, args=(lookback_minutes,), daemon=True, name="news-refresh").start()
    return {**status(), "started": True}
