"""
test_backend.py — Basic CRUD route tests using an in-memory SQLite database.

All tests use a TestClient backed by an isolated SQLite in-memory session so
they run without a live Postgres instance.  generate_research is mocked to
return a fixed dict, keeping tests fast and deterministic.
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app

# ---------------------------------------------------------------------------
# Test database — SQLite in-memory, one connection shared across threads
# ---------------------------------------------------------------------------

SQLITE_URL = "sqlite:///file::memory:?cache=shared&uri=true"

test_engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False, "uri": True},
)
TestSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)

# Fixed mock research returned by generate_research during tests
MOCK_RESEARCH = {
    "one_liner": "A test explanation",
    "mechanism": "It works like this",
    "when_to_use": "Use it when testing",
    "tradeoffs": "Pros:\n- Fast\nCons:\n- Limited",
    "interview": "This is a test concept.",
    "related": "testing, mocking",
    "diagram": "",
}


def override_get_db():
    """DB dependency override using the test engine."""
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def reset_db():
    """Create tables before each test and drop them after."""
    Base.metadata.create_all(test_engine)
    yield
    Base.metadata.drop_all(test_engine)


@pytest.fixture()
def client():
    """Return a TestClient wired to the in-memory SQLite DB."""
    app.dependency_overrides[get_db] = override_get_db

    # Suppress startup event so it doesn't call create_all_tables on the
    # production engine, and mock out generate_research for all route calls.
    with patch("backend.main.create_all_tables"):
        with patch("backend.main.generate_research", return_value=MOCK_RESEARCH):
            with TestClient(app) as c:
                yield c

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _create_topic(client: TestClient, name: str = "Binary Search") -> dict:
    """POST /topics and return the response JSON."""
    resp = client.post("/topics", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_create_topic(client):
    """POST /topics should create a topic, run research, return 201 with all fields."""
    data = _create_topic(client)

    assert data["name"] == "Binary Search"
    assert data["status"] == "reading"
    assert "id" in data
    assert "created_at" in data

    # Research block should be embedded
    research = data["research"]
    assert research is not None
    for key in ("one_liner", "mechanism", "when_to_use", "tradeoffs", "interview", "related", "diagram"):
        assert key in research, f"Missing research field: {key}"

    # Notes list should start empty
    assert data["notes"] == []


def test_list_topics_empty(client):
    """GET /topics on an empty DB should return an empty list."""
    resp = client.get("/topics")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_topics_returns_created_topic(client):
    """GET /topics should include a topic after it has been created."""
    _create_topic(client, name="Quicksort")

    resp = client.get("/topics")
    assert resp.status_code == 200
    topics = resp.json()
    assert len(topics) == 1
    assert topics[0]["name"] == "Quicksort"
    assert topics[0]["status"] == "reading"


def test_get_topic_by_id(client):
    """GET /topics/{id} should return the full topic including research."""
    created = _create_topic(client, name="Merge Sort")
    topic_id = created["id"]

    resp = client.get(f"/topics/{topic_id}")
    assert resp.status_code == 200

    data = resp.json()
    assert data["id"] == topic_id
    assert data["name"] == "Merge Sort"
    assert data["research"] is not None
    assert data["research"]["one_liner"] == MOCK_RESEARCH["one_liner"]
    assert isinstance(data["notes"], list)


def test_get_topic_404(client):
    """GET /topics/{id} with an unknown UUID should return 404."""
    import uuid
    fake_id = str(uuid.uuid4())
    resp = client.get(f"/topics/{fake_id}")
    assert resp.status_code == 404


def test_delete_topic(client):
    """DELETE /topics/{id} should return 204 and remove the topic."""
    created = _create_topic(client, name="Heap Sort")
    topic_id = created["id"]

    del_resp = client.delete(f"/topics/{topic_id}")
    assert del_resp.status_code == 204

    # Topic should be gone
    get_resp = client.get(f"/topics/{topic_id}")
    assert get_resp.status_code == 404


def test_delete_topic_404(client):
    """DELETE /topics/{id} with an unknown UUID should return 404."""
    import uuid
    fake_id = str(uuid.uuid4())
    resp = client.delete(f"/topics/{fake_id}")
    assert resp.status_code == 404


def test_list_topics_after_delete(client):
    """After deleting the only topic, GET /topics should return an empty list."""
    created = _create_topic(client)
    client.delete(f"/topics/{created['id']}")

    resp = client.get("/topics")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_topic_empty_name_rejected(client):
    """POST /topics with an empty or whitespace name should return 422."""
    for bad_name in ("", "   ", "\t\n"):
        resp = client.post("/topics", json={"name": bad_name})
        assert resp.status_code == 422, (
            f"Expected 422 for name={repr(bad_name)}, got {resp.status_code}"
        )


def test_patch_topic_status(client):
    """PATCH /topics/{id}/status should update the status field."""
    created = _create_topic(client)
    topic_id = created["id"]

    resp = client.patch(f"/topics/{topic_id}/status", json={"status": "reviewed"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "reviewed"


def test_patch_status_invalid_value(client):
    """PATCH /topics/{id}/status with an invalid status should return 422."""
    created = _create_topic(client)
    topic_id = created["id"]

    resp = client.patch(f"/topics/{topic_id}/status", json={"status": "unknown_status"})
    assert resp.status_code == 422


def test_create_and_delete_note(client):
    """POST /topics/{id}/notes should save a note; DELETE should remove it."""
    created = _create_topic(client)
    topic_id = created["id"]

    # Create note
    note_resp = client.post(f"/topics/{topic_id}/notes", json={"content": "Important insight"})
    assert note_resp.status_code == 201
    note = note_resp.json()
    assert note["content"] == "Important insight"
    note_id = note["id"]

    # Note should appear in GET /topics/{id}
    topic_data = client.get(f"/topics/{topic_id}").json()
    assert any(n["id"] == note_id for n in topic_data["notes"])

    # Delete note
    del_resp = client.delete(f"/topics/{topic_id}/notes/{note_id}")
    assert del_resp.status_code == 204

    # Note should be gone
    topic_data2 = client.get(f"/topics/{topic_id}").json()
    assert not any(n["id"] == note_id for n in topic_data2["notes"])


def test_cascade_delete_removes_research_and_notes(client):
    """Deleting a topic should cascade-delete its research and notes."""
    created = _create_topic(client)
    topic_id = created["id"]

    # Add a note
    client.post(f"/topics/{topic_id}/notes", json={"content": "Note to be deleted"})

    # Delete topic
    client.delete(f"/topics/{topic_id}")

    # Topic endpoint should 404
    assert client.get(f"/topics/{topic_id}").status_code == 404
