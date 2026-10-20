"""
NewsAPI.org connector — broad general/financial news coverage.
Free tier: 100 requests/day, articles capped at ~1 month old, dev-only license.
"""
from datetime import datetime

import httpx

from app.core.config import settings
from app.services.news_ingestion.base import BaseFetcher, RawArticle

NEWSAPI_URL = "https://newsapi.org/v2/everything"

# Keep this deliberately narrow for Phase 1 — broaden once dedup/clustering
# (Phase 2) is in place to handle the extra noise.
DEFAULT_QUERY = (
    '(stocks OR markets OR economy OR inflation OR "interest rates" OR '
    'earnings OR "central bank" OR geopolitical)'
)


class NewsAPIFetcher(BaseFetcher):
    source_type = "news_outlet"

    def fetch_latest(self, since: datetime | None = None) -> list[RawArticle]:
        params = {
            "q": DEFAULT_QUERY,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 50,
            "apiKey": settings.NEWSAPI_KEY,
        }
        if since:
            params["from"] = since.isoformat()

        with httpx.Client(timeout=15.0) as client:
            resp = client.get(NEWSAPI_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        articles = []
        for item in data.get("articles", []):
            published_at = None
            if item.get("publishedAt"):
                published_at = datetime.fromisoformat(
                    item["publishedAt"].replace("Z", "+00:00")
                )
            articles.append(
                RawArticle(
                    source_name=item.get("source", {}).get("name", "Unknown"),
                    source_type=self.source_type,
                    title=item.get("title", ""),
                    url=item.get("url", ""),
                    published_at=published_at,
                    # NewsAPI free tier only gives a truncated snippet, not
                    # full body text — good enough for clustering/dedup,
                    # not for deep summarization. Flagged in docs/roadmap.md.
                    raw_text=item.get("content") or item.get("description") or "",
                )
            )
        return articles
