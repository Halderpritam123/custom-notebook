"""
permissions.py — FastAPI dependency factory for topic access control.

Covers Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
"""
from __future__ import annotations

from typing import Literal

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.models import Topic, User
from app.services.sharing import sharing_service


def require_topic_access(mode: Literal["read", "write"]):
    """
    FastAPI dependency factory for topic access control.

    Returns a dependency that:
      - Resolves the Topic from the `topic_id` path parameter
      - For mode="read": permits if requester is the owner OR has share access
      - For mode="write": permits only if requester is the owner
      - Always returns 403 (never 404) to prevent resource enumeration
      - Returns the resolved Topic object for use in route handlers

    Usage:
        @router.get("/topics/{topic_id}")
        def get_topic(topic: Topic = Depends(require_topic_access("read")), ...):
            ...
    """

    async def _dep(
        topic_id: str,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> Topic:
        # Fetch the topic — always return 403 regardless of whether it exists,
        # to prevent enumeration of other users' resource IDs (Req 4.3)
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if topic is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied.",
            )

        is_owner = str(topic.user_id) == str(current_user.id)

        if mode == "write":
            # Write: only owners are permitted (Req 4.1, 4.2)
            if not is_owner:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied.",
                )
        else:
            # Read: owner OR recipient with share access (Req 4.4)
            if not is_owner:
                has_access = sharing_service.has_share_access(db, current_user.id, topic_id)
                if not has_access:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied.",
                    )

        return topic

    return _dep
