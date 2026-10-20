"""
Education router — Phase 6 scope: glossary lookup + lesson listing.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user_data import GlossaryTerm, Lesson, UserLessonProgress, User

router = APIRouter(prefix="/education", tags=["education"])


@router.get("/ping")
def ping():
    return {"status": "ok", "router": "education"}


@router.get("/glossary")
def list_glossary(db: Session = Depends(get_db)):
    terms = db.query(GlossaryTerm).order_by(GlossaryTerm.term).all()
    return [
        {
            "term": t.term,
            "simple_explanation": t.simple_explanation,
            "example": t.example,
            "why_it_matters": t.why_it_matters,
        }
        for t in terms
    ]


@router.get("/glossary/{term}")
def get_glossary_term(term: str, db: Session = Depends(get_db)):
    result = db.query(GlossaryTerm).filter(GlossaryTerm.term.ilike(term)).first()
    if not result:
        return {"found": False}
    return {
        "found": True,
        "term": result.term,
        "simple_explanation": result.simple_explanation,
        "example": result.example,
        "why_it_matters": result.why_it_matters,
    }


@router.get("/lessons")
def list_lessons(
    difficulty: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lessons with the current user's completion status attached."""
    query = db.query(Lesson)
    if difficulty:
        query = query.filter(Lesson.difficulty == difficulty)
    lessons = query.all()

    completed_ids = {
        str(p.lesson_id)
        for p in db.query(UserLessonProgress).filter(UserLessonProgress.user_id == current_user.id).all()
    }

    return [
        {
            "id": str(l.id),
            "title": l.title,
            "content": l.content,
            "difficulty": l.difficulty,
            "completed": str(l.id) in completed_ids,
        }
        for l in lessons
    ]


@router.post("/lessons/{lesson_id}/complete")
def mark_lesson_complete(
    lesson_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(UserLessonProgress)
        .filter(UserLessonProgress.user_id == current_user.id, UserLessonProgress.lesson_id == lesson_id)
        .first()
    )
    if not existing:
        db.add(
            UserLessonProgress(
                user_id=current_user.id,
                lesson_id=lesson_id,
                completed_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
    return {"status": "completed", "lesson_id": lesson_id}
