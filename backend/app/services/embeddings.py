"""
Thin wrapper around OpenAI's embeddings endpoint.

Why OpenAI here and Anthropic everywhere else: Claude does not currently
expose an embeddings API, and embeddings are needed for semantic dedup/
clustering (this module) and RAG retrieval (Phase 7 tutor). Isolated in
one place so swapping providers later (e.g. Voyage AI) only touches this file.
"""
import httpx

from app.core.config import settings

OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings"


def get_embedding(text: str) -> list[float]:
    """Returns a single embedding vector for the given text."""
    return get_embeddings([text])[0]


def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Batch embedding call — always prefer this over N single calls."""
    if not texts:
        return []

    with httpx.Client(timeout=30.0) as client:
        resp = client.post(
            OPENAI_EMBEDDINGS_URL,
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            json={"model": settings.EMBEDDING_MODEL, "input": texts},
        )
        resp.raise_for_status()
        data = resp.json()

    # OpenAI returns results in the same order as input
    return [item["embedding"] for item in data["data"]]
