"""
topics.py — topic CRUD, chat, notes, and research retry routes.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user
from app.database import SessionLocal, get_db
from app.models.models import Research, SavedNote, Topic, User
from app.schemas.schemas import (
    ChatBody, CreateNoteBody, CreateTopicBody, RenameBody, UpdateStatusBody,
)
from app.services.llm import generate_chat_reply, generate_research

router = APIRouter(tags=["topics"])

VALID_STATUSES = {"researching", "reading", "reviewed"}


# ---------------------------------------------------------------------------
# Serialisation helpers (used by categories router too)
# ---------------------------------------------------------------------------

def _serialize_topic_list_item(topic: Topic) -> dict:
    return {
        "id": str(topic.id),
        "name": topic.name,
        "status": topic.status,
        "created_at": topic.created_at.isoformat() if topic.created_at else None,
    }


def _serialize_research(research) -> dict | None:
    if research is None:
        return None
    return {
        "id": str(research.id),
        "one_liner": research.one_liner,
        "mechanism": research.mechanism,
        "when_to_use": research.when_to_use,
        "tradeoffs": research.tradeoffs,
        "interview": research.interview,
        "related": research.related,
        "diagram": research.diagram,
    }


def _serialize_note(note: SavedNote) -> dict:
    return {
        "id": str(note.id),
        "content": note.content,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


def _serialize_full_topic(topic: Topic) -> dict:
    return {
        "id": str(topic.id),
        "name": topic.name,
        "status": topic.status,
        "created_at": topic.created_at.isoformat() if topic.created_at else None,
        "research": _serialize_research(topic.research),
        "notes": [_serialize_note(n) for n in (topic.notes or [])],
    }


def _serialize_main_topic(topic: Topic) -> dict:
    return {
        "id": str(topic.id),
        "name": topic.name,
        "created_at": topic.created_at.isoformat() if topic.created_at else None,
        "sub_topics": [_serialize_topic_list_item(c) for c in (topic.children or [])],
    }


def _owned_topic(topic_id: str, user: User, db: Session) -> Topic:
    topic = (
        db.query(Topic)
        .options(joinedload(Topic.research), joinedload(Topic.notes))
        .filter(Topic.id == topic_id, Topic.user_id == user.id)
        .first()
    )
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


# ---------------------------------------------------------------------------
# Background research job
# ---------------------------------------------------------------------------

def _run_research_in_background(topic_id: str) -> None:
    db = SessionLocal()
    try:
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if topic is None:
            return
        try:
            data = generate_research(topic.name)
            existing = db.query(Research).filter(Research.topic_id == topic_id).first()
            if existing:
                db.delete(existing)
                db.flush()
            db.add(Research(topic_id=topic.id, **data))
            topic.status = "reading"
            db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/topics", status_code=201)
def create_topic(
    body: CreateTopicBody,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="Topic name must not be empty")

    parent_id = None
    if body.parent_id is not None:
        parent = db.query(Topic).filter(
            Topic.id == body.parent_id, Topic.user_id == current_user.id, Topic.is_folder == True
        ).first()
        if parent is None:
            raise HTTPException(status_code=404, detail="Parent category not found")
        parent_id = parent.id

    topic = Topic(name=body.name.strip(), status="researching", user_id=current_user.id, parent_id=parent_id)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    background_tasks.add_task(_run_research_in_background, str(topic.id))
    return _serialize_full_topic(topic)


@router.get("/topics")
def list_topics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[dict]:
    topics = db.query(Topic).filter(Topic.user_id == current_user.id).all()
    return [_serialize_topic_list_item(t) for t in topics]


@router.get("/topics/{topic_id}")
def get_topic(topic_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    return _serialize_full_topic(_owned_topic(topic_id, current_user, db))


@router.patch("/topics/{topic_id}/status")
def update_topic_status(
    topic_id: str, body: UpdateStatusBody,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
) -> dict:
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status '{body.status}'")
    topic = _owned_topic(topic_id, current_user, db)
    topic.status = body.status
    db.commit()
    db.refresh(topic)
    return _serialize_topic_list_item(topic)


@router.patch("/topics/{topic_id}/name")
def rename_topic(
    topic_id: str, body: RenameBody,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
) -> dict:
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="Name must not be empty")
    topic = _owned_topic(topic_id, current_user, db)
    topic.name = body.name.strip()
    db.commit()
    db.refresh(topic)
    return _serialize_topic_list_item(topic)


@router.delete("/topics/{topic_id}", status_code=204)
def delete_topic(topic_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Response:
    topic = _owned_topic(topic_id, current_user, db)
    db.delete(topic)
    db.commit()
    return Response(status_code=204)


@router.post("/topics/{topic_id}/retry", status_code=200)
def retry_research(
    topic_id: str, background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
) -> dict:
    topic = _owned_topic(topic_id, current_user, db)
    topic.status = "researching"
    existing = db.query(Research).filter(Research.topic_id == topic_id).first()
    if existing:
        db.delete(existing)
    db.commit()
    db.refresh(topic)
    background_tasks.add_task(_run_research_in_background, str(topic.id))
    return _serialize_full_topic(topic)


@router.post("/topics/{topic_id}/chat")
def chat(
    topic_id: str, body: ChatBody,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
) -> dict:
    topic = _owned_topic(topic_id, current_user, db)
    reply = generate_chat_reply(topic.name, list(body.history) + [{"role": "user", "content": body.message}])
    return {"reply": reply}


@router.post("/topics/{topic_id}/notes", status_code=201)
def create_note(
    topic_id: str, body: CreateNoteBody,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
) -> dict:
    topic = _owned_topic(topic_id, current_user, db)
    note = SavedNote(topic_id=topic.id, content=body.content, created_at=datetime.now(timezone.utc))
    db.add(note)
    db.commit()
    db.refresh(note)
    return _serialize_note(note)


@router.delete("/topics/{topic_id}/notes/{note_id}", status_code=204)
def delete_note(
    topic_id: str, note_id: str,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
) -> Response:
    _owned_topic(topic_id, current_user, db)
    note = db.query(SavedNote).filter(SavedNote.id == note_id, SavedNote.topic_id == topic_id).first()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return Response(status_code=204)
