"""
Orchestrates Phase 1: fetch from all configured sources, do cheap
dedup (exact URL + near-identical title), persist to `articles`.

Deliberately NOT doing embedding-based semantic clustering here — that's
Phase 2 (`event_clustering.py`, not yet built). This module's only job is
"get raw articles into the DB without obvious duplicates."
"""
import logging
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from app.models.news import Article, Source
from app.services.news_ingestion.base import RawArticle
from app.services.news_ingestion.newsapi_fetcher import NewsAPIFetcher
from app.services.news_ingestion.marketaux_fetcher import MarketauxFetcher
from app.services.news_ingestion.source_reputation import get_source_reputation

logger = logging.getLogger(__name__)

FETCHERS = [NewsAPIFetcher(), MarketauxFetcher()]

# Two titles closer than this ratio are treated as the same story.
# Tuned conservatively (high bar) — Phase 2's embedding clustering will
# catch the semantic duplicates this simple string match misses.
TITLE_SIMILARITY_THRESHOLD = 0.90


def _title_is_duplicate(title: str, recent_titles: list[str]) -> bool:
    return any(
        SequenceMatcher(None, title.lower(), existing.lower()).ratio()
        >= TITLE_SIMILARITY_THRESHOLD
        for existing in recent_titles
    )


def _get_or_create_source(db: Session, name: str, source_type: str) -> Source:
    source = db.query(Source).filter(Source.name == name).first()
    if source:
        return source
    source = Source(
        name=name,
        type=source_type,
        base_reliability_score=get_source_reputation(name),
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


def run_ingestion_cycle(db: Session, lookback_minutes: int = 30) -> dict:
    """
    Fetch from every configured source, dedupe against both the incoming
    batch and recently-stored articles, persist the rest.
    Returns a summary dict for logging/monitoring.
    """
    since = datetime.now(timezone.utc) - timedelta(minutes=lookback_minutes)

    # Pull recent titles already in DB to dedupe against, not just within this batch
    recent_articles = (
        db.query(Article.title)
        .filter(Article.fetched_at >= since)
        .all()
    )
    seen_titles = [t[0] for t in recent_articles]

    fetched_count = 0
    stored_count = 0
    skipped_duplicates = 0
    errors: list[str] = []

    for fetcher in FETCHERS:
        try:
            raw_articles: list[RawArticle] = fetcher.fetch_latest(since=since)
        except Exception as exc:  # noqa: BLE001 - log and continue with other sources
            logger.error("Fetcher %s failed: %s", fetcher.__class__.__name__, exc)
            errors.append(f"{fetcher.__class__.__name__}: {exc}")
            continue

        fetched_count += len(raw_articles)

        for raw in raw_articles:
            if not raw.title or not raw.url:
                continue

            existing_by_url = db.query(Article).filter(Article.url == raw.url).first()
            if existing_by_url or _title_is_duplicate(raw.title, seen_titles):
                skipped_duplicates += 1
                continue

            source = _get_or_create_source(db, raw.source_name, raw.source_type)
            article = Article(
                source_id=source.id,
                title=raw.title,
                url=raw.url,
                published_at=raw.published_at,
                raw_text=raw.raw_text,
                # embedding populated in Phase 2 once clustering is built
            )
            db.add(article)
            seen_titles.append(raw.title)
            stored_count += 1

        db.commit()

    summary = {
        "fetched": fetched_count,
        "stored": stored_count,
        "skipped_duplicates": skipped_duplicates,
        "errors": errors,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("Ingestion cycle complete: %s", summary)
    return summary
