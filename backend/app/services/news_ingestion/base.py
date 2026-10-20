"""
Common interface for news source connectors. Each connector knows how to
talk to one external API and normalize its response into `RawArticle` —
everything downstream (dedup, clustering, entity extraction) works against
this normalized shape regardless of which API it came from.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime


@dataclass
class RawArticle:
    source_name: str
    source_type: str          # news_outlet | company_filing | government | central_bank | social
    title: str
    url: str
    published_at: datetime | None
    raw_text: str


class BaseFetcher(ABC):
    """Subclass this for each news source. One responsibility: fetch + normalize."""

    source_type: str = "news_outlet"

    @abstractmethod
    def fetch_latest(self, since: datetime | None = None) -> list[RawArticle]:
        """Return normalized articles published since the given timestamp."""
        raise NotImplementedError
