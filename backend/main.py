"""
main.py — FastAPI application for AI Knowledge Notebook.
"""

import os
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

try:
    from backend.database import SavedNote, Topic, Research, User, create_all_tables, get_db
    from backend.llm import generate_chat_reply, generate_research
    from backend.auth import (
        create_access_token, get_current_user, hash_password, verify_password,
        find_or_create_oauth_user,
    )
except ModuleNotFoundError:
    from database import SavedNote, Topic, Research, User, create_all_tables, get_db
    from llm import generate_chat_reply, generate_research
    from auth import (
        create_access_token, get_current_user, hash_password, verify_password,
        find_or_create_oauth_user,
    )

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
REGISTRATION_OPEN = os.getenv("REGISTRATION_OPEN", "true").lower() == "true"

app = FastAPI(title="AI Knowledge Notebook")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    create_all_tables()


# ── Request bodies ────────────────────────────────────────────────────────────

class RegisterBody(BaseModel):
    email: str
    password: str

class LoginBody(BaseModel):
    email: str
    password: str

class CreateTopicBody(BaseModel):
    name: str

class UpdateStatusBody(BaseModel):
    status: str

class ChatBody(BaseModel):
    message: str
    history: list[dict[str, Any]] = []

class CreateNoteBody(BaseModel):
    content: str


# ── Serialisation helpers ─────────────────────────────────────────────────────

VALID_STATUSES = {"researching", "reading", "reviewed"}


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
    notes_sorted = sorted(topic.notes or [], key=lambda n: n.created_at or datetime.min)
    return {
        "id": str(topic.id),
        "name": topic.name,
        "status": topic.status,
        "created_at": topic.created_at.isoformat() if topic.created_at else None,
        "research": _serialize_research(topic.research),
        "notes": [_serialize_note(n) for n in notes_sorted],
    }


def _owned_topic(topic_id: str, user: User, db: Session) -> Topic:
    """Return topic if it exists and belongs to the current user, else 404."""
    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == user.id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.get("/auth/status")
def auth_status() -> dict:
    """Public endpoint — frontend checks this to show/hide registration UI."""
    return {"registration_open": REGISTRATION_OPEN}


@app.post("/auth/register", status_code=201)
def register(body: RegisterBody, db: Session = Depends(get_db)) -> dict:
    if not REGISTRATION_OPEN:
        raise HTTPException(status_code=403, detail="Registrations are temporarily closed.")
    if not body.email or not body.password:
        raise HTTPException(status_code=422, detail="Email and password required")
    existing = db.query(User).filter(User.email == body.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(email=body.email.lower(), hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id))
    return {"token": token, "email": user.email}


@app.post("/auth/login")
def login(body: LoginBody, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(str(user.id))
    return {"token": token, "email": user.email}


@app.get("/auth/me")
def me(current_user: User = Depends(get_current_user)) -> dict:
    return {"id": str(current_user.id), "email": current_user.email}


# ── Google OAuth ──────────────────────────────────────────────────────────────

@app.get("/auth/google")
def google_login():
    params = (
        f"client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={BACKEND_URL}/auth/google/callback"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&access_type=offline"
    )
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@app.get("/auth/google/callback")
def google_callback(code: str, db: Session = Depends(get_db)):
    # Exchange code for tokens
    token_resp = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": f"{BACKEND_URL}/auth/google/callback",
            "grant_type": "authorization_code",
        },
    )
    if token_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}?error=google_token_failed")

    access_token = token_resp.json().get("access_token")

    # Get user info from Google
    userinfo_resp = httpx.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if userinfo_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}?error=google_userinfo_failed")

    info = userinfo_resp.json()
    email = info.get("email")
    provider_user_id = info.get("id")

    if not email or not provider_user_id:
        return RedirectResponse(f"{FRONTEND_URL}?error=google_missing_fields")

    user = find_or_create_oauth_user(db, "google", provider_user_id, email,
                                     registration_open=REGISTRATION_OPEN)
    if user is None:
        return RedirectResponse(f"{FRONTEND_URL}?error=registration_closed")
    jwt_token = create_access_token(str(user.id))
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?token={jwt_token}&email={email}")


# ── GitHub OAuth ──────────────────────────────────────────────────────────────

@app.get("/auth/github")
def github_login():
    params = (
        f"client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={BACKEND_URL}/auth/github/callback"
        f"&scope=user:email"
    )
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{params}")


@app.get("/auth/github/callback")
def github_callback(code: str, db: Session = Depends(get_db)):
    # Exchange code for access token
    token_resp = httpx.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": f"{BACKEND_URL}/auth/github/callback",
        },
    )
    if token_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}?error=github_token_failed")

    access_token = token_resp.json().get("access_token")

    # Get user profile
    user_resp = httpx.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )
    if user_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}?error=github_userinfo_failed")

    user_data = user_resp.json()
    provider_user_id = user_data.get("id")
    email = user_data.get("email")

    # GitHub may not expose email in profile — fetch from emails endpoint
    if not email:
        emails_resp = httpx.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        if emails_resp.status_code == 200:
            primary = next(
                (e["email"] for e in emails_resp.json() if e.get("primary") and e.get("verified")),
                None,
            )
            email = primary

    if not email or not provider_user_id:
        return RedirectResponse(f"{FRONTEND_URL}?error=github_missing_fields")

    user = find_or_create_oauth_user(db, "github", str(provider_user_id), email,
                                     registration_open=REGISTRATION_OPEN)
    if user is None:
        return RedirectResponse(f"{FRONTEND_URL}?error=registration_closed")
    jwt_token = create_access_token(str(user.id))
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?token={jwt_token}&email={email}")


# ── Topic routes (all protected) ──────────────────────────────────────────────

@app.post("/topics", status_code=201)
def create_topic(
    body: CreateTopicBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="Topic name must not be empty or whitespace")

    topic = Topic(name=body.name.strip(), status="researching", user_id=current_user.id)
    db.add(topic)
    db.commit()
    db.refresh(topic)

    research_data = generate_research(topic.name)

    research = Research(
        topic_id=topic.id,
        one_liner=research_data["one_liner"],
        mechanism=research_data["mechanism"],
        when_to_use=research_data["when_to_use"],
        tradeoffs=research_data["tradeoffs"],
        interview=research_data["interview"],
        related=research_data["related"],
        diagram=research_data["diagram"],
    )
    db.add(research)
    topic.status = "reading"
    db.commit()
    db.refresh(topic)
    return _serialize_full_topic(topic)


@app.get("/topics")
def list_topics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    topics = db.query(Topic).filter(Topic.user_id == current_user.id).all()
    return [_serialize_topic_list_item(t) for t in topics]


@app.get("/topics/{topic_id}")
def get_topic(
    topic_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return _serialize_full_topic(_owned_topic(topic_id, current_user, db))


@app.patch("/topics/{topic_id}/status")
def update_topic_status(
    topic_id: str,
    body: UpdateStatusBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status '{body.status}'")
    topic = _owned_topic(topic_id, current_user, db)
    topic.status = body.status
    db.commit()
    db.refresh(topic)
    return _serialize_topic_list_item(topic)


@app.delete("/topics/{topic_id}", status_code=204)
def delete_topic(
    topic_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    topic = _owned_topic(topic_id, current_user, db)
    db.delete(topic)
    db.commit()
    return Response(status_code=204)


@app.post("/topics/{topic_id}/retry", status_code=200)
def retry_research(
    topic_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    topic = _owned_topic(topic_id, current_user, db)
    existing = db.query(Research).filter(Research.topic_id == topic_id).first()
    if existing:
        db.delete(existing)
        db.commit()
    research_data = generate_research(topic.name)
    research = Research(
        topic_id=topic.id,
        one_liner=research_data["one_liner"],
        mechanism=research_data["mechanism"],
        when_to_use=research_data["when_to_use"],
        tradeoffs=research_data["tradeoffs"],
        interview=research_data["interview"],
        related=research_data["related"],
        diagram=research_data["diagram"],
    )
    db.add(research)
    topic.status = "reading"
    db.commit()
    db.refresh(topic)
    return _serialize_full_topic(topic)


@app.post("/topics/{topic_id}/chat")
def chat(
    topic_id: str,
    body: ChatBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    topic = _owned_topic(topic_id, current_user, db)
    full_history = list(body.history) + [{"role": "user", "content": body.message}]
    reply = generate_chat_reply(topic.name, full_history)
    return {"reply": reply}


@app.post("/topics/{topic_id}/notes", status_code=201)
def create_note(
    topic_id: str,
    body: CreateNoteBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    topic = _owned_topic(topic_id, current_user, db)
    note = SavedNote(topic_id=topic.id, content=body.content, created_at=datetime.now(timezone.utc))
    db.add(note)
    db.commit()
    db.refresh(note)
    return _serialize_note(note)


@app.delete("/topics/{topic_id}/notes/{note_id}", status_code=204)
def delete_note(
    topic_id: str,
    note_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    _owned_topic(topic_id, current_user, db)
    note = db.query(SavedNote).filter(
        SavedNote.id == note_id, SavedNote.topic_id == topic_id
    ).first()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return Response(status_code=204)
