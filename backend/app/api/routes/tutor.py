"""
Tutor router — Phase 7 scope: conversational Q&A grounded in stored events + glossary.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user_data import User, TutorConversation, TutorMessage
from app.services.tutor_service import ask_tutor
from app.services import analyst_context

router = APIRouter(prefix="/tutor", tags=["tutor"])


@router.get("/ping")
def ping():
    return {"status": "ok", "router": "tutor"}


class AskRequest(BaseModel):
    question: str
    conversation_id: str | None = None
    explanation_mode: str = "simple"  # simple | advanced


@router.post("/ask")
def ask(
    payload: AskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.conversation_id:
        conversation = (
            db.query(TutorConversation)
            .filter(TutorConversation.id == payload.conversation_id, TutorConversation.user_id == current_user.id)
            .first()
        )
    else:
        conversation = None

    if not conversation:
        conversation = TutorConversation(user_id=current_user.id)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    answer = ask_tutor(
        db,
        conversation_id=conversation.id,
        question=payload.question,
        explanation_mode=payload.explanation_mode,
        user_context=analyst_context.build_context(db, current_user, payload.question),
    )
    return {"conversation_id": str(conversation.id), "answer": answer}


@router.get("/conversations")
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The user's past tutor chats, newest first, titled by their first question."""
    convos = (
        db.query(TutorConversation)
        .filter(TutorConversation.user_id == current_user.id)
        .order_by(TutorConversation.created_at.desc())
        .limit(30)
        .all()
    )
    out = []
    for c in convos:
        first = (
            db.query(TutorMessage)
            .filter(TutorMessage.conversation_id == c.id, TutorMessage.role == "user")
            .order_by(TutorMessage.created_at.asc())
            .first()
        )
        if not first:
            continue  # empty conversation (e.g. the key was missing) — nothing to show
        title = first.content.strip().replace("\n", " ")
        out.append({
            "id": str(c.id),
            "title": title[:70] + ("…" if len(title) > 70 else ""),
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return out


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    convo = (
        db.query(TutorConversation)
        .filter(TutorConversation.id == conversation_id, TutorConversation.user_id == current_user.id)
        .first()
    )
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = (
        db.query(TutorMessage)
        .filter(TutorMessage.conversation_id == convo.id)
        .order_by(TutorMessage.created_at.asc())
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in messages]
