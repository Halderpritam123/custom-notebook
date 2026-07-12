"""
topics.py — topic CRUD, chat, notes, and research retry routes.
"""
import asyncio
from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.core.limiter import limiter
from app.core.security import get_current_user
from app.database import SessionLocal, get_db
from app.models.models import Research, SavedNote, Topic, User
from app.schemas.schemas import (
    ChatBody, CreateNoteBody, UpdateNoteBody, CreateTopicBody, RenameBody, UpdateStatusBody,
    UpdateResearchBody,
)
from app.services.llm import generate_chat_reply, generate_research

router = APIRouter(tags=["topics"])

VALID_STATUSES = {"researching", "reading", "reviewed"}

# In-memory event registry: topic_id -> asyncio.Event
# The background job sets the event when research finishes.
# The SSE endpoint awaits it — no DB polling needed.
_research_events: Dict[str, asyncio.Event] = {}


# ---------------------------------------------------------------------------
# Serialisation helpers (used by categories router too)
# ---------------------------------------------------------------------------

def _serialize_topic_list_item(topic: Topic) -> dict:
    return {
        "id": str(topic.id),
        "name": topic.name,
        "is_folder": False,
        "status": topic.status,
        "created_at": topic.created_at.isoformat() if topic.created_at else None,
    }


def _serialize_research(research) -> dict | None:
    if research is None:
        return None
    return {
        "id": str(research.id),
        "summary": research.summary,
        "key_concepts": research.key_concepts,
        "background_context": research.background_context,
        "how_it_works": research.how_it_works,
        "real_world_applications": research.real_world_applications,
        "common_misconceptions": research.common_misconceptions,
        "related_topics": research.related_topics,
        "open_questions": research.open_questions,
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
        "is_folder": True,
        "created_at": topic.created_at.isoformat() if topic.created_at else None,
        "children": [
            _serialize_main_topic(c) if c.is_folder else _serialize_topic_list_item(c)
            for c in (topic.children or [])
        ],
    }


def _owned_topic(topic_id: str, user: User, db: Session, load_relations: bool = True) -> Topic:
    q = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == user.id)
    if load_relations:
        q = q.options(joinedload(Topic.research), joinedload(Topic.notes))
    topic = q.first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


# ---------------------------------------------------------------------------
# Background research job
# ---------------------------------------------------------------------------

def _run_research_in_background(topic_id: str, loop: asyncio.AbstractEventLoop) -> None:
    db = SessionLocal()
    try:
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if topic is None:
            return
        ancestor_names = []
        current = topic
        while current.parent_id is not None:
            parent = db.query(Topic).filter(Topic.id == current.parent_id).first()
            if parent and parent.is_folder:
                ancestor_names.insert(0, parent.name)
                current = parent
            else:
                break
        category_name = " > ".join(ancestor_names) if ancestor_names else None
        try:
            data = generate_research(topic.name, category_name=category_name)
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
        # Signal any waiting SSE connection — runs thread-safe on the event loop
        event = _research_events.pop(topic_id, None)
        if event and not loop.is_closed():
            loop.call_soon_threadsafe(event.set)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/topics", status_code=201)
@limiter.limit("5/minute")
async def create_topic(
    request: Request,
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
    loop = asyncio.get_event_loop()
    _research_events[str(topic.id)] = asyncio.Event()
    background_tasks.add_task(_run_research_in_background, str(topic.id), loop)
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
    topic = _owned_topic(topic_id, current_user, db, load_relations=False)
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
    topic = _owned_topic(topic_id, current_user, db, load_relations=False)
    topic.name = body.name.strip()
    db.commit()
    db.refresh(topic)
    return _serialize_topic_list_item(topic)


@router.delete("/topics/{topic_id}", status_code=204)
def delete_topic(topic_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Response:
    topic = _owned_topic(topic_id, current_user, db, load_relations=False)
    db.delete(topic)
    db.commit()
    return Response(status_code=204)


@router.post("/topics/{topic_id}/retry", status_code=200)
@limiter.limit("3/minute")
async def retry_research(
    request: Request,
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
    loop = asyncio.get_event_loop()
    _research_events[str(topic.id)] = asyncio.Event()
    background_tasks.add_task(_run_research_in_background, str(topic.id), loop)
    return _serialize_full_topic(topic)


@router.get("/topics/{topic_id}/status-stream")
async def status_stream(
    topic_id: str,
    token: str,
    db: Session = Depends(get_db),
):
    """SSE — awaits an in-memory event set by the background job. Zero DB polling."""
    from jose import JWTError, jwt
    from app.config import JWT_SECRET
    ALGORITHM = "HS256"
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == user.id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    async def event_generator():
        # Already done — send immediately
        if topic.status != "researching":
            yield f"data: {topic.status}\n\n"
            return

        event = _research_events.get(topic_id)
        if event is None:
            # No event registered (e.g. server restarted) — send current status
            yield f"data: {topic.status}\n\n"
            return

        try:
            # Wait up to 5 minutes, sending keep-alives every 20s to prevent proxy timeouts
            deadline = 300
            elapsed = 0
            while elapsed < deadline:
                try:
                    await asyncio.wait_for(asyncio.shield(event.wait()), timeout=20)
                    break
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    elapsed += 20
        except asyncio.CancelledError:
            return

        # One fresh DB session for the single final read — request-scoped session is already closed
        final_db = SessionLocal()
        try:
            final_topic = final_db.query(Topic).filter(Topic.id == topic_id).first()
            final_status = final_topic.status if final_topic else "reading"
        finally:
            final_db.close()
        yield f"data: {final_status}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.patch("/topics/{topic_id}/research", status_code=200)
def update_research(
    topic_id: str, body: UpdateResearchBody,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
) -> dict:
    topic = _owned_topic(topic_id, current_user, db)
    research = db.query(Research).filter(Research.topic_id == topic_id).first()
    if research is None:
        raise HTTPException(status_code=404, detail="Research not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(research, field, value)
    db.commit()
    db.refresh(research)
    return _serialize_research(research)


@router.post("/topics/{topic_id}/chat")
@limiter.limit("10/minute")
def chat(
    request: Request,
    topic_id: str, body: ChatBody,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
) -> dict:
    topic = _owned_topic(topic_id, current_user, db)
    # Walk ancestors for full context path
    ancestor_names = []
    current = topic
    while current.parent_id is not None:
        parent = db.query(Topic).filter(Topic.id == current.parent_id).first()
        if parent and parent.is_folder:
            ancestor_names.insert(0, parent.name)
            current = parent
        else:
            break
    category_name = " > ".join(ancestor_names) if ancestor_names else None
    reply = generate_chat_reply(topic.name, list(body.history) + [{"role": "user", "content": body.message}], category_name=category_name)
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


@router.patch("/topics/{topic_id}/notes/{note_id}", status_code=200)
def update_note(
    topic_id: str, note_id: str, body: UpdateNoteBody,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
) -> dict:
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=422, detail="Content must not be empty")
    _owned_topic(topic_id, current_user, db)
    note = db.query(SavedNote).filter(SavedNote.id == note_id, SavedNote.topic_id == topic_id).first()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    note.content = body.content.strip()
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
