"""
Models for the news intelligence pipeline:
sources -> articles -> events (clustered) -> event_entities

Design note: `articles` (raw, provenance) is deliberately kept separate from
`events` (AI-clustered interpretation) and `ai_analyses` (AI opinion).
This lets the UI always show "what was actually reported" distinct from
"what the AI thinks it means" — important for user trust and for the
credibility-scoring feature.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Text, TIMESTAMP, Integer, ForeignKey, JSON
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.core.db import Base


def gen_uuid():
    return uuid.uuid4()


class Source(Base):
    __tablename__ = "sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # news_outlet | company_filing | government | central_bank | social
    base_reliability_score = Column(Integer)  # 0-100 static prior
    url = Column(String)

    articles = relationship("Article", back_populates="source")


class Article(Base):
    __tablename__ = "articles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"))
    title = Column(String, nullable=False)
    url = Column(String, nullable=False)
    published_at = Column(TIMESTAMP(timezone=True))
    raw_text = Column(Text)
    embedding = Column(JSON)  # list[float], stored as plain JSON — no Postgres extension needed
    fetched_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    source = relationship("Source", back_populates="articles")


class Event(Base):
    """A clustered, deduplicated real-world event made up of 1+ articles."""
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False)          # AI-generated headline
    summary = Column(Text)                          # AI-generated neutral summary
    event_type = Column(String)                     # geopolitical | economic | company | central_bank
    first_seen_at = Column(TIMESTAMP(timezone=True))
    last_updated_at = Column(TIMESTAMP(timezone=True))
    credibility_score = Column(Integer)              # 0-100 computed
    credibility_breakdown = Column(JSON)             # {source_reputation, confirmations, official, historical}

    entities = relationship("EventEntity", back_populates="event")
    analyses = relationship("AIAnalysis", back_populates="event")
    historical_analogues = relationship("HistoricalAnalogue", back_populates="event")


class EventArticle(Base):
    """Join table: which raw articles fed into which clustered event."""
    __tablename__ = "event_articles"

    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id"), primary_key=True)
    article_id = Column(UUID(as_uuid=True), ForeignKey("articles.id"), primary_key=True)


class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    ticker = Column(String, unique=True)
    name = Column(String, nullable=False)
    sector = Column(String)
    industry = Column(String)


class EventEntity(Base):
    """Extracted entity (company/sector/country/economic factor) tied to an event."""
    __tablename__ = "event_entities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id"))
    entity_type = Column(String, nullable=False)   # company | sector | country | economic_factor
    entity_value = Column(String, nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True)
    predicted_effect = Column(String)               # positive | negative | mixed | unclear

    event = relationship("Event", back_populates="entities")


class AIAnalysis(Base):
    """
    Hedged, structured AI opinion about an event. Never a recommendation —
    schema enforces scores + reasoning buckets rather than free-text advice.
    """
    __tablename__ = "ai_analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id"))
    opportunity_score = Column(Integer)   # 0-100
    confidence_score = Column(Integer)    # 0-100
    reasoning_positive = Column(ARRAY(String))
    reasoning_negative = Column(ARRAY(String))
    reasoning_unknown = Column(ARRAY(String))
    short_term_view = Column(Text)
    long_term_view = Column(Text)
    risks = Column(ARRAY(String))
    model_version = Column(String)        # track prompt/model version for auditability
    generated_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    event = relationship("Event", back_populates="analyses")


class HistoricalAnalogue(Base):
    __tablename__ = "historical_analogues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id"))
    analogue_year = Column(Integer)
    analogue_description = Column(Text)
    avg_market_reaction = Column(Text)
    sectors_affected = Column(ARRAY(String))
    disclaimer = Column(String, default="Historical patterns do not guarantee future results.")

    event = relationship("Event", back_populates="historical_analogues")
