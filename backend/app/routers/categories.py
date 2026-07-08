"""
categories.py — category (main topic / folder) routes + topic tree.
"""
import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session, subqueryload

from app.core.security import get_current_user
from app.database import get_db
from app.models.models import Topic, User
from app.routers.topics import _serialize_main_topic, _serialize_topic_list_item
from app.schemas.schemas import CreateCategoryBody, RenameBody

router = APIRouter(tags=["categories"])


@router.post("/main-topics", status_code=201)
def create_category(
    body: CreateCategoryBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="Category name must not be empty")
    topic = Topic(name=body.name.strip(), is_folder=True, status="folder", user_id=current_user.id)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return _serialize_main_topic(topic)


@router.delete("/main-topics/{topic_id}", status_code=204)
def delete_category(
    topic_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    topic = db.query(Topic).filter(
        Topic.id == topic_id, Topic.user_id == current_user.id, Topic.is_folder == True
    ).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(topic)
    db.commit()
    return Response(status_code=204)


@router.patch("/main-topics/{topic_id}/name")
def rename_category(
    topic_id: str,
    body: RenameBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="Name must not be empty")
    topic = db.query(Topic).filter(
        Topic.id == topic_id, Topic.user_id == current_user.id, Topic.is_folder == True
    ).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Category not found")
    topic.name = body.name.strip()
    db.commit()
    db.refresh(topic)
    return _serialize_main_topic(topic)


@router.get("/topic-tree")
def get_topic_tree(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    all_topics = (
        db.query(Topic)
        .filter(Topic.user_id == current_user.id)
        .options(subqueryload(Topic.children))
        .all()
    )
    payload = {
        "main_topics": [_serialize_main_topic(t) for t in all_topics if t.is_folder],
        "root_topics": [_serialize_topic_list_item(t) for t in all_topics if not t.is_folder and t.parent_id is None],
    }

    body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    etag = f'"{hashlib.md5(body.encode()).hexdigest()}"'

    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})

    return Response(content=body, media_type="application/json",
                    headers={"ETag": etag, "Cache-Control": "no-cache"})
