"""
AI analyst. Answers questions from live data (see analyst_context): the user's
portfolio, fresh credible headlines, signals and any stocks named in the
question. Keeps the conversation history so follow-ups work.
"""
import logging
from pathlib import Path

import anthropic
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user_data import GlossaryTerm, TutorMessage

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).resolve().parents[1] / "prompts" / "tutor_response.md"
SYSTEM_PROMPT = PROMPT_PATH.read_text()

_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

HISTORY_TURNS = 8


def _glossary_hint(db: Session, question: str, limit: int = 3) -> str:
    """Only used when the user is clearly asking what a term means."""
    q = question.lower()
    if not any(k in q for k in ("what is", "what's", "what does", "explain", "meaning", "define")):
        return ""
    words = [w.strip("?.,!").lower() for w in question.split() if len(w) > 3]
    if not words:
        return ""
    rows = db.query(GlossaryTerm).filter(or_(*[GlossaryTerm.term.ilike(f"%{w}%") for w in words])).limit(limit).all()
    return "\n".join(f"- {t.term}: {t.simple_explanation}" for t in rows)


def _history(db: Session, conversation_id) -> list[dict]:
    rows = (
        db.query(TutorMessage)
        .filter(TutorMessage.conversation_id == conversation_id)
        .order_by(TutorMessage.created_at.desc())
        .limit(HISTORY_TURNS)
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in reversed(rows)]


def ask_tutor(
    db: Session,
    conversation_id,
    question: str,
    explanation_mode: str = "simple",
    user_context: str | None = None,
) -> str:
    if not settings.ANTHROPIC_API_KEY:
        return (
            "The AI analyst needs an Anthropic API key to answer. Add ANTHROPIC_API_KEY to the "
            "backend's .env file and restart the backend."
        )

    deep = explanation_mode == "advanced"
    hint = _glossary_hint(db, question)
    prompt = (
        f"Mode: {'Deep dive' if deep else 'Quick'}\n\n"
        f"LIVE CONTEXT\n{user_context or 'No live context available.'}\n\n"
        + (f"GLOSSARY (only if the user wants a term explained)\n{hint}\n\n" if hint else "")
        + f"QUESTION: {question}"
    )
    messages = _history(db, conversation_id) + [{"role": "user", "content": prompt}]
    # The API requires the first message to be from the user.
    while messages and messages[0]["role"] != "user":
        messages.pop(0)

    response = _client.messages.create(
        model=settings.AI_MODEL,
        max_tokens=1500 if deep else 800,
        system=SYSTEM_PROMPT,
        messages=messages,
    )
    answer = "".join(b.text for b in response.content if b.type == "text").strip()

    db.add(TutorMessage(conversation_id=conversation_id, role="user", content=question, explanation_mode=explanation_mode))
    db.add(TutorMessage(conversation_id=conversation_id, role="assistant", content=answer, explanation_mode=explanation_mode))
    db.commit()
    return answer
