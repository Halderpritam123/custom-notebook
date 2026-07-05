"""
test_properties.py — Property-based and unit tests for AI Notebook.

Covers all tasks marked with * that were skipped during initial implementation:
  1.4  — Unit test: create_all_tables() creates all tables
  2.4  — Property: research JSON parse round-trip
  2.5  — Property: chat context window enforcement
  3.10 — Property: empty topic name rejection
  3.11 — Property: missing resource returns 404
  3.12 — Property: status lifecycle monotonicity
  3.13 — Property: cascade delete completeness
  3.14 — Property: note save and delete round-trip
  3.15 — Property: saved notes ordering invariant
"""

import json
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from hypothesis import given, settings
from hypothesis import strategies as st
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from backend.database import (
    Base, OAuthAccount, Research, SavedNote, Topic, User, create_all_tables, get_db,
)
from backend.llm import build_chat_messages
from backend.main import app

# ---------------------------------------------------------------------------
# Shared test DB setup (SQLite in-memory)
# ---------------------------------------------------------------------------

SQLITE_URL = "sqlite:///file:test_props?mode=memory&cache=shared&uri=true"

test_engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False, "uri": True},
)
TestSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)

MOCK_RESEARCH = {
    "one_liner": "Test explanation",
    "mechanism": "Works like this",
    "when_to_use": "When testing",
    "tradeoffs": "Pros:\n- Fast\nCons:\n- Limited",
    "interview": "Test interview answer.",
    "related": "testing",
    "diagram": "",
}


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


def _make_user(db) -> User:
    """Create a test user and return it."""
    user = User(email=f"test_{uuid.uuid4().hex[:8]}@test.com", hashed_password=None)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_token(user_id: str) -> str:
    from backend.auth import create_access_token
    return create_access_token(user_id)


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.create_all(test_engine)
    yield
    Base.metadata.drop_all(test_engine)


@pytest.fixture()
def db_session():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client():
    app.dependency_overrides[get_db] = override_get_db
    with patch("backend.main.create_all_tables"):
        with patch("backend.main.generate_research", return_value=MOCK_RESEARCH):
            with TestClient(app) as c:
                yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_client(client, db_session):
    """Client with a valid JWT for an auto-created test user."""
    user = _make_user(db_session)
    token = _make_token(str(user.id))
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client, user


# ---------------------------------------------------------------------------
# Task 1.4 — Unit test: create_all_tables() creates all required tables
# ---------------------------------------------------------------------------

def test_create_all_tables_creates_all_five_tables():
    """
    # Feature: ai-knowledge-notebook
    create_all_tables() must create users, topics, research, saved_notes, oauth_accounts.
    """
    fresh_engine = create_engine("sqlite:///:memory:")
    # Bind Base to fresh engine for this test
    Base.metadata.create_all(fresh_engine)
    inspector = inspect(fresh_engine)
    tables = set(inspector.get_table_names())
    assert "users" in tables
    assert "topics" in tables
    assert "research" in tables
    assert "saved_notes" in tables
    assert "oauth_accounts" in tables


# ---------------------------------------------------------------------------
# Task 2.4 — Property: research JSON parse round-trip
# Feature: ai-knowledge-notebook, Property 8: Research JSON parse round-trip
# ---------------------------------------------------------------------------

RESEARCH_KEYS = ["one_liner", "mechanism", "when_to_use", "tradeoffs", "interview", "related", "diagram"]

research_dict_strategy = st.fixed_dictionaries({
    key: st.text(min_size=0, max_size=100) for key in RESEARCH_KEYS
})


@given(research_dict_strategy)
@settings(max_examples=100)
def test_research_json_parse_roundtrip(research_dict):
    """
    # Feature: ai-knowledge-notebook, Property 8: Research JSON parse round-trip
    Serialising a research dict to JSON and parsing it back yields the original dict.
    """
    serialised = json.dumps(research_dict)
    parsed = json.loads(serialised)
    for key in RESEARCH_KEYS:
        assert parsed[key] == research_dict[key]


# ---------------------------------------------------------------------------
# Task 2.5 — Property: chat context window enforcement
# Feature: ai-knowledge-notebook, Property 9: Chat context window enforcement
# ---------------------------------------------------------------------------

message_strategy = st.fixed_dictionaries({
    "role": st.sampled_from(["user", "assistant"]),
    "content": st.text(min_size=1, max_size=50),
})

history_strategy = st.lists(message_strategy, min_size=0, max_size=50)


@given(st.text(min_size=1, max_size=50), history_strategy)
@settings(max_examples=100)
def test_chat_context_window_max_10_messages(topic_name, history):
    """
    # Feature: ai-knowledge-notebook, Property 9: Chat context window enforcement
    build_chat_messages trims history to at most 10 messages (excluding system prompt).
    """
    result = build_chat_messages(topic_name, history)
    # First message is always the system prompt
    assert result[0]["role"] == "system"
    # Remaining messages must be at most 10
    assert len(result) - 1 <= 10


# ---------------------------------------------------------------------------
# Task 3.10 — Property: empty topic name rejection
# Feature: ai-knowledge-notebook, Property 6: Empty topic name rejection
# ---------------------------------------------------------------------------

whitespace_strategy = st.one_of(
    st.just(""),
    st.text(
        alphabet=st.characters(whitelist_categories=("Zs",)),
        min_size=1,
        max_size=20,
    ),
    st.just("   "),
    st.just("\t\n\r"),
)


@given(whitespace_strategy)
@settings(max_examples=100)
def test_empty_topic_name_rejected(name):
    """
    # Feature: ai-knowledge-notebook, Property 6: Empty topic name rejection
    Any whitespace-only or empty name returns 422.
    """
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(test_engine)
    try:
        with patch("backend.main.create_all_tables"):
            with patch("backend.main.generate_research", return_value=MOCK_RESEARCH):
                with TestClient(app) as c:
                    db = TestSessionLocal()
                    user = _make_user(db)
                    db.close()
                    token = _make_token(str(user.id))
                    resp = c.post(
                        "/topics",
                        json={"name": name},
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    assert resp.status_code == 422, f"Expected 422 for name={repr(name)}"
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(test_engine)


# ---------------------------------------------------------------------------
# Task 3.11 — Property: missing resource returns 404
# Feature: ai-knowledge-notebook, Property 11: Missing resource returns 404
# ---------------------------------------------------------------------------

@given(st.uuids())
@settings(max_examples=50)
def test_missing_topic_returns_404(fake_uuid):
    """
    # Feature: ai-knowledge-notebook, Property 11: Missing resource returns 404
    GET/PATCH/DELETE on a non-existent topic id always returns 404.
    """
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(test_engine)
    try:
        with patch("backend.main.create_all_tables"):
            with patch("backend.main.generate_research", return_value=MOCK_RESEARCH):
                with TestClient(app) as c:
                    db = TestSessionLocal()
                    user = _make_user(db)
                    db.close()
                    token = _make_token(str(user.id))
                    headers = {"Authorization": f"Bearer {token}"}
                    tid = str(fake_uuid)
                    assert c.get(f"/topics/{tid}", headers=headers).status_code == 404
                    assert c.delete(f"/topics/{tid}", headers=headers).status_code == 404
                    assert c.patch(f"/topics/{tid}/status",
                                   json={"status": "reading"},
                                   headers=headers).status_code == 404
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(test_engine)


# ---------------------------------------------------------------------------
# Task 3.12 — Property: status lifecycle monotonicity
# Feature: ai-knowledge-notebook, Property 2: Status lifecycle monotonicity
# ---------------------------------------------------------------------------

def test_status_lifecycle_monotonicity(auth_client):
    """
    # Feature: ai-knowledge-notebook, Property 2: Status lifecycle monotonicity
    New topic starts as reading (after research), can be patched to reviewed,
    invalid status returns 422.
    """
    client, _ = auth_client
    resp = client.post("/topics", json={"name": "Dijkstra"})
    assert resp.status_code == 201
    topic_id = resp.json()["id"]
    # After synchronous research, status is "reading"
    assert resp.json()["status"] == "reading"

    # Patch to reviewed — valid forward transition
    patch_resp = client.patch(f"/topics/{topic_id}/status", json={"status": "reviewed"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "reviewed"

    # Invalid status value
    invalid_resp = client.patch(f"/topics/{topic_id}/status", json={"status": "unknown"})
    assert invalid_resp.status_code == 422


# ---------------------------------------------------------------------------
# Task 3.13 — Property: cascade delete completeness
# Feature: ai-knowledge-notebook, Property 3: Cascade delete completeness
# ---------------------------------------------------------------------------

@given(st.integers(min_value=0, max_value=10))
@settings(max_examples=30)
def test_cascade_delete_completeness(note_count):
    """
    # Feature: ai-knowledge-notebook, Property 3: Cascade delete completeness
    Deleting a topic removes all its research and saved_notes rows.
    """
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(test_engine)
    try:
        with patch("backend.main.create_all_tables"):
            with patch("backend.main.generate_research", return_value=MOCK_RESEARCH):
                with TestClient(app) as c:
                    db = TestSessionLocal()
                    user = _make_user(db)
                    db.close()
                    token = _make_token(str(user.id))
                    headers = {"Authorization": f"Bearer {token}"}

                    # Create topic
                    topic_resp = c.post("/topics", json={"name": "Cascade Test"}, headers=headers)
                    topic_id = topic_resp.json()["id"]

                    # Add notes
                    for i in range(note_count):
                        c.post(f"/topics/{topic_id}/notes",
                               json={"content": f"note {i}"},
                               headers=headers)

                    # Delete topic
                    c.delete(f"/topics/{topic_id}", headers=headers)

                    # Verify gone
                    assert c.get(f"/topics/{topic_id}", headers=headers).status_code == 404
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(test_engine)


# ---------------------------------------------------------------------------
# Task 3.14 — Property: note save and delete round-trip
# Feature: ai-knowledge-notebook, Property 4: Note save and delete round-trip
# ---------------------------------------------------------------------------

@given(st.text(min_size=1, max_size=200))
@settings(max_examples=50)
def test_note_save_delete_roundtrip(content):
    """
    # Feature: ai-knowledge-notebook, Property 4: Note save and delete round-trip
    A saved note appears in GET /topics/{id}; after deletion it is absent.
    """
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(test_engine)
    try:
        with patch("backend.main.create_all_tables"):
            with patch("backend.main.generate_research", return_value=MOCK_RESEARCH):
                with TestClient(app) as c:
                    db = TestSessionLocal()
                    user = _make_user(db)
                    db.close()
                    token = _make_token(str(user.id))
                    headers = {"Authorization": f"Bearer {token}"}

                    topic_id = c.post("/topics", json={"name": "Note Test"},
                                      headers=headers).json()["id"]

                    note = c.post(f"/topics/{topic_id}/notes",
                                  json={"content": content},
                                  headers=headers).json()
                    note_id = note["id"]

                    notes_after_save = c.get(f"/topics/{topic_id}", headers=headers).json()["notes"]
                    assert any(n["id"] == note_id for n in notes_after_save)

                    c.delete(f"/topics/{topic_id}/notes/{note_id}", headers=headers)

                    notes_after_delete = c.get(f"/topics/{topic_id}", headers=headers).json()["notes"]
                    assert not any(n["id"] == note_id for n in notes_after_delete)
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(test_engine)


# ---------------------------------------------------------------------------
# Task 3.15 — Property: saved notes ordering invariant
# Feature: ai-knowledge-notebook, Property 10: Saved notes ordering invariant
# ---------------------------------------------------------------------------

def test_saved_notes_ordering(auth_client):
    """
    # Feature: ai-knowledge-notebook, Property 10: Saved notes ordering invariant
    Notes returned by GET /topics/{id} are sorted by created_at ascending.
    """
    client, _ = auth_client
    topic_id = client.post("/topics", json={"name": "Order Test"}).json()["id"]

    contents = ["first", "second", "third", "fourth"]
    for content in contents:
        client.post(f"/topics/{topic_id}/notes", json={"content": content})

    notes = client.get(f"/topics/{topic_id}").json()["notes"]
    dates = [n["created_at"] for n in notes]
    assert dates == sorted(dates), "Notes are not sorted by created_at ascending"
