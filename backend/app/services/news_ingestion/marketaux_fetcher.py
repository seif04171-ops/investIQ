"""
Marketaux connector — finance-specific news with built-in entity tagging
(tickers, sentiment). We still run our own entity extraction/credibility
pipeline downstream, but Marketaux's ticker tags are useful as a signal
to cross-check our own extraction against in Phase 3.
"""
from datetime import datetime

import httpx

from app.core.config import settings
from app.services.news_ingestion.base import BaseFetcher, RawArticle

MARKETAUX_URL = "https://api.marketaux.com/v1/news/all"


class MarketauxFetcher(BaseFetcher):
    source_type = "news_outlet"

    def fetch_latest(self, since: datetime | None = None) -> list[RawArticle]:
        params = {
            "api_token": settings.MARKETAUX_KEY,
            "language": "en",
            "filter_entities": "true",
            "limit": 50,
        }
        if since:
            params["published_after"] = since.strftime("%Y-%m-%dT%H:%M:%S")

        with httpx.Client(timeout=15.0) as client:
            resp = client.get(MARKETAUX_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        articles = []
        for item in data.get("data", []):
            published_at = None
            if item.get("published_at"):
                published_at = datetime.fromisoformat(
                    item["published_at"].replace("Z", "+00:00")
                )
            articles.append(
                RawArticle(
                    source_name=item.get("source", "Unknown"),
                    source_type=self.source_type,
                    title=item.get("title", ""),
                    url=item.get("url", ""),
                    published_at=published_at,
                    raw_text=item.get("description") or item.get("snippet") or "",
                )
            )
        return articles
