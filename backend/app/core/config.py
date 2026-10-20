"""
Centralized configuration. Loaded once, imported everywhere.
All secrets come from environment variables / .env — never hardcoded.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- App ---
    APP_NAME: str = "InvestIQ"
    ENV: str = "development"
    DEBUG: bool = True

    # --- Database ---
    DATABASE_URL: str = "postgresql://investiq:investiq@localhost:5432/investiq"

    # --- Auth (self-hosted email/password) ---
    JWT_SECRET_KEY: str = "dev-secret-change-this-before-any-real-deployment"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week — fine for MVP, tighten later

    # --- AI ---
    ANTHROPIC_API_KEY: str = ""
    AI_MODEL: str = "claude-sonnet-4-6"
    OPENAI_API_KEY: str = ""              # used only for embeddings (Claude has no embeddings endpoint)
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EVENT_CLUSTER_SIMILARITY_THRESHOLD: float = 0.83

    # --- News sources ---
    NEWSAPI_KEY: str = ""
    MARKETAUX_KEY: str = ""
    FINNHUB_API_KEY: str = ""

    # --- Redis / Celery ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- Ingestion cadence ---
    NEWS_POLL_INTERVAL_MINUTES: int = 20
    REFRESH_ON_STARTUP: bool = True      # fetch fresh news as soon as the backend boots

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
