"""
Models for everything user-owned: auth profile, education progress,
tutor conversations, portfolio simulator, watchlist.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, TIMESTAMP, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.core.db import Base


def gen_uuid():
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    display_name = Column(String)
    experience_level = Column(String, default="beginner")  # beginner | intermediate | advanced
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    portfolios = relationship("Portfolio", back_populates="user")
    watchlist_items = relationship("WatchlistItem", back_populates="user")


class GlossaryTerm(Base):
    __tablename__ = "glossary_terms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    term = Column(String, unique=True, nullable=False)
    simple_explanation = Column(Text)
    example = Column(Text)
    why_it_matters = Column(Text)


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    title = Column(String)
    content = Column(Text)
    difficulty = Column(String)  # beginner | intermediate | advanced
    related_terms = Column(ARRAY(UUID(as_uuid=True)))


class UserLessonProgress(Base):
    __tablename__ = "user_lesson_progress"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id"), primary_key=True)
    completed_at = Column(TIMESTAMP(timezone=True))


class TutorConversation(Base):
    __tablename__ = "tutor_conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    messages = relationship("TutorMessage", back_populates="conversation")


class TutorMessage(Base):
    __tablename__ = "tutor_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("tutor_conversations.id"))
    role = Column(String)  # user | assistant
    content = Column(Text)
    explanation_mode = Column(String)  # simple | advanced
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    conversation = relationship("TutorConversation", back_populates="messages")


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    cash_balance = Column(Numeric, default=100000)  # simulated money only
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="portfolios")
    holdings = relationship("PortfolioHolding", back_populates="portfolio")
    transactions = relationship("PortfolioTransaction", back_populates="portfolio")


class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id"))
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"))
    shares = Column(Numeric, nullable=False)
    avg_buy_price = Column(Numeric, nullable=False)

    portfolio = relationship("Portfolio", back_populates="holdings")


class PortfolioTransaction(Base):
    __tablename__ = "portfolio_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id"))
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"))
    action = Column(String)  # buy | sell
    shares = Column(Numeric)
    price_per_share = Column(Numeric)
    note = Column(Text)  # decision-journal entry: why the user made this trade
    executed_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    portfolio = relationship("Portfolio", back_populates="transactions")


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), primary_key=True)
    added_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="watchlist_items")
