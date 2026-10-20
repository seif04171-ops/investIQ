"""
Import all models here so Alembic's autogenerate can discover them
via Base.metadata (see alembic/env.py).
"""
from app.models.news import (   # noqa: F401
    Source, Article, Event, EventArticle, Company, EventEntity,
    AIAnalysis, HistoricalAnalogue,
)
from app.models.user_data import (   # noqa: F401
    User, GlossaryTerm, Lesson, UserLessonProgress,
    TutorConversation, TutorMessage,
    Portfolio, PortfolioHolding, PortfolioTransaction,
    WatchlistItem,
)
