"""
News router — Phase 1 scope: raw ingested articles only.
Event clustering, entity extraction, credibility scoring, and AI analysis
are separate routers/phases that will read from the same `articles` table.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.news import Article
from app.services.news_ingestion.ingestion_service import run_ingestion_cycle
from app.services import news_live, universe

router = APIRouter(prefix="/news", tags=["news"])


@router.get("/ping")
def ping():
    return {"status": "ok", "router": "news"}


@router.post("/ingest")
def trigger_ingestion(
    lookback_minutes: int = Query(30, ge=1, le=1440),
    db: Session = Depends(get_db),
):
    """
    Manually trigger one ingestion cycle. Useful for testing without
    waiting for the scheduled interval. In production this stays available
    but should be auth-gated (admin-only) before launch.
    """
    return run_ingestion_cycle(db, lookback_minutes=lookback_minutes)


@router.post("/refresh")
def refresh_news(force: bool = True):
    """Fetch the latest headlines right now (background). Poll /news/refresh/status."""
    return news_live.start_refresh(force=force)


@router.get("/refresh/status")
def refresh_status():
    return news_live.status()


@router.get("/live")
def live_news(
    ticker: str | None = None,
    effect: str | None = Query(None, pattern="^(positive|negative|neutral)$"),
    category: str | None = None,
    sort: str = Query("smart", pattern="^(smart|latest)$"),
    limit: int = Query(50, ge=1, le=150),
):
    """
    Live headlines tagged with the stocks they affect. sort=smart puts stories
    that actually move stocks first; sort=latest is strictly newest-first.
    """
    kw = {"ticker": ticker, "effect": effect}
    items = news_live.ranked(limit=limit * 2, **kw) if sort == "smart" else news_live.get_items(limit=limit * 2, **kw)
    if category:
        items = [i for i in items if any((universe.BY_TICKER.get(t) and universe.BY_TICKER[t].category == category) for t in i["tickers"])]
    return {"items": items[:limit], "status": news_live.status()}


@router.get("/articles")
def list_articles(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Raw ingested articles, newest first. Phase 1 has no clustering yet,
    so this is deliberately just the raw feed — duplicates across
    near-identical stories from different outlets are expected here
    until Phase 2 groups them into `events`.
    """
    articles = (
        db.query(Article)
        .order_by(Article.fetched_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(a.id),
            "title": a.title,
            "url": a.url,
            "source_id": str(a.source_id) if a.source_id else None,
            "published_at": a.published_at.isoformat() if a.published_at else None,
            "fetched_at": a.fetched_at.isoformat() if a.fetched_at else None,
        }
        for a in articles
    ]
