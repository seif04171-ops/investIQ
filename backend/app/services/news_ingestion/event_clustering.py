"""
Phase 2: semantic clustering of raw articles into `Event` rows.

Approach for MVP: for each un-clustered article, embed its title+snippet,
compare against embeddings of *recent* existing events (last 48h — no
reason to compare against month-old events), attach to the closest match
above threshold, or create a new event if nothing matches closely enough.

This is single-pass nearest-neighbor clustering, not a global clustering
algorithm (HDBSCAN etc.) — good enough for MVP volumes. Revisit if/when
duplicate-event rates in production suggest single-pass isn't cutting it.
"""
import logging
from datetime import datetime, timedelta, timezone

import numpy as np
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.news import Article, Event, EventArticle
from app.services.embeddings import get_embeddings

logger = logging.getLogger(__name__)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    a_arr, b_arr = np.array(a), np.array(b)
    denom = (np.linalg.norm(a_arr) * np.linalg.norm(b_arr))
    if denom == 0:
        return 0.0
    return float(np.dot(a_arr, b_arr) / denom)


def run_clustering_cycle(db: Session, lookback_hours: int = 48) -> dict:
    """
    Find articles without an embedding yet, embed them, then either attach
    them to an existing recent event or create a new one.
    """
    if not settings.OPENAI_API_KEY:
        # Embeddings need an OpenAI key. Skip cleanly rather than crash the
        # whole background pipeline with an httpx error about an empty
        # Authorization header — this is an expected, normal state for
        # anyone who hasn't added that key yet, not a real failure.
        logger.info("Skipping clustering cycle — OPENAI_API_KEY not configured yet.")
        return {"processed": 0, "new_events": 0, "attached_to_existing": 0, "skipped": "no OPENAI_API_KEY"}

    since = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)

    unembedded = db.query(Article).filter(Article.embedding.is_(None)).all()
    if not unembedded:
        return {"processed": 0, "new_events": 0, "attached_to_existing": 0}

    texts = [f"{a.title}. {a.raw_text or ''}"[:2000] for a in unembedded]
    try:
        embeddings = get_embeddings(texts)
    except Exception as exc:
        # Covers rate limits, no billing configured, network issues, etc. —
        # any of these should skip this cycle cleanly rather than crash the
        # whole pipeline. The key being *present* doesn't guarantee OpenAI
        # will actually accept the request (e.g. no billing added yet).
        logger.warning("Skipping clustering cycle — embeddings call failed: %s", exc)
        return {"processed": 0, "new_events": 0, "attached_to_existing": 0, "skipped": f"embeddings error: {exc}"}
    for article, emb in zip(unembedded, embeddings):
        article.embedding = emb
    db.commit()

    recent_events = (
        db.query(Event)
        .filter(Event.last_updated_at >= since)
        .all()
    )
    # cache event "centroid" embeddings (mean of member article embeddings)
    event_embeddings: dict = {}
    for event in recent_events:
        member_articles = (
            db.query(Article)
            .join(EventArticle, EventArticle.article_id == Article.id)
            .filter(EventArticle.event_id == event.id, Article.embedding.isnot(None))
            .all()
        )
        if member_articles:
            vecs = [a.embedding for a in member_articles]
            event_embeddings[event.id] = np.mean(np.array(vecs), axis=0).tolist()

    new_events = 0
    attached = 0

    for article in unembedded:
        best_event = None
        best_score = 0.0
        for event_id, centroid in event_embeddings.items():
            score = _cosine_similarity(article.embedding, centroid)
            if score > best_score:
                best_score = score
                best_event = event_id

        if best_event and best_score >= settings.EVENT_CLUSTER_SIMILARITY_THRESHOLD:
            db.add(EventArticle(event_id=best_event, article_id=article.id))
            event = db.query(Event).filter(Event.id == best_event).first()
            event.last_updated_at = datetime.now(timezone.utc)
            attached += 1
        else:
            new_event = Event(
                title=article.title,   # placeholder headline; Phase 3 replaces with AI-generated one
                event_type="unclassified",
                first_seen_at=article.published_at or datetime.now(timezone.utc),
                last_updated_at=datetime.now(timezone.utc),
            )
            db.add(new_event)
            db.flush()  # get new_event.id before commit
            db.add(EventArticle(event_id=new_event.id, article_id=article.id))
            event_embeddings[new_event.id] = article.embedding
            new_events += 1

    db.commit()

    summary = {
        "processed": len(unembedded),
        "new_events": new_events,
        "attached_to_existing": attached,
    }
    logger.info("Clustering cycle complete: %s", summary)
    return summary
