"""
sharing.py — SharingService for creating, revoking, and querying topic shares.

Covers Requirements: 2.1–2.6, 3.1, 3.3, 5.1–5.6
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import TYPE_CHECKING

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.models import Share, Topic, User
from app.schemas.schemas import SharedResourceNode, SharedWithMeGroup
from app.services.cache import cache

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class SharingService:
    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create_share(
        self,
        db: Session,
        owner_id,
        resource_id,
        recipient_id,
    ) -> Share:
        """
        Create a Share record granting recipient_id read access to resource_id.

        - Validates the resource (Topic) exists AND belongs to owner_id → 403
        - Validates recipient user exists → 404
        - Upserts: returns existing Share if (owner_id, recipient_id, resource_id) already exists
        - Invalidates topic_tree:{recipient_id} cache on creation
        """
        # Validate ownership
        topic = db.query(Topic).filter(Topic.id == resource_id).first()
        if topic is None or str(topic.user_id) != str(owner_id):
            raise HTTPException(
                status_code=403,
                detail="Resource not found or does not belong to you.",
            )

        # Validate recipient exists
        recipient = db.query(User).filter(User.id == recipient_id).first()
        if recipient is None:
            raise HTTPException(
                status_code=404,
                detail="Recipient user not found.",
            )

        # Upsert: return existing share to avoid duplicates (Req 2.4)
        existing = (
            db.query(Share)
            .filter(
                Share.owner_id == owner_id,
                Share.recipient_id == recipient_id,
                Share.resource_id == resource_id,
            )
            .first()
        )
        if existing is not None:
            return existing

        # Create new Share record
        share = Share(
            owner_id=owner_id,
            recipient_id=recipient_id,
            resource_id=resource_id,
        )
        db.add(share)
        db.commit()
        db.refresh(share)

        # Invalidate recipient's topic tree cache (Req 2.3, 7.3)
        cache.delete_tree(str(recipient_id))

        return share

    def revoke_share(
        self,
        db: Session,
        owner_id,
        share_id,
    ) -> None:
        """
        Delete a Share record by share_id.

        - Validates share exists → 404
        - Validates requester is the owner → 403
        - Invalidates topic_tree:{recipient_id} and topic:{resource_id} cache entries
        """
        share = db.query(Share).filter(Share.id == share_id).first()
        if share is None:
            raise HTTPException(status_code=404, detail="Share not found.")

        if str(share.owner_id) != str(owner_id):
            raise HTTPException(
                status_code=403,
                detail="You do not own this share.",
            )

        recipient_id = share.recipient_id
        resource_id = share.resource_id

        db.delete(share)
        db.commit()

        # Invalidate caches (Req 5.2, 5.3, 7.3)
        cache.delete_tree(str(recipient_id))
        cache.delete_topic(str(resource_id))

    def list_shares_for_resource(
        self,
        db: Session,
        resource_id,
        owner_id,
    ) -> list[Share]:
        """
        Return all Share records for a given resource.

        - Validates requester owns the resource → 403
        """
        topic = db.query(Topic).filter(Topic.id == resource_id).first()
        if topic is None or str(topic.user_id) != str(owner_id):
            raise HTTPException(
                status_code=403,
                detail="Resource not found or does not belong to you.",
            )

        return (
            db.query(Share)
            .filter(Share.resource_id == resource_id)
            .all()
        )

    def get_shared_with_me(
        self,
        db: Session,
        user_id,
    ) -> list[SharedWithMeGroup]:
        """
        Return all content shared with user_id, grouped by owner.
        Deduplicates: if a topic is already covered by a shared ancestor folder
        from the same owner, the individual topic share is not shown separately.
        """
        shares = (
            db.query(Share)
            .filter(Share.recipient_id == user_id)
            .all()
        )

        # Group shares by owner
        owner_shares: dict[str, list[Share]] = defaultdict(list)
        for share in shares:
            owner_shares[str(share.owner_id)].append(share)

        groups: list[SharedWithMeGroup] = []
        for owner_id_str, owner_share_list in owner_shares.items():
            owner = owner_share_list[0].owner
            if owner is None:
                owner = db.query(User).filter(User.id == owner_id_str).first()
            if owner is None:
                continue

            # Collect all resource IDs shared directly with this recipient by this owner
            shared_resource_ids = {str(s.resource_id) for s in owner_share_list}

            # Build deduplicated node list:
            # Skip a share if any of its ancestors is also directly shared by the same owner
            # (it will already appear nested inside the folder node)
            nodes: list[SharedResourceNode] = []
            for share in owner_share_list:
                resource = share.resource
                if resource is None:
                    resource = db.query(Topic).filter(Topic.id == share.resource_id).first()
                if resource is None:
                    continue

                # Walk up ancestor chain — if any ancestor is in shared_resource_ids, skip this node
                if self._has_shared_ancestor(db, resource, shared_resource_ids):
                    continue

                node = self._build_resource_node(db, resource)
                nodes.append(node)

            if nodes:
                groups.append(
                    SharedWithMeGroup(
                        owner_id=str(owner.id),
                        owner_email=owner.email,
                        share_ids=[str(s.id) for s in owner_share_list],
                        nodes=nodes,
                    )
                )

        return groups

    def _has_shared_ancestor(
        self,
        db: Session,
        topic: Topic,
        shared_resource_ids: set[str],
    ) -> bool:
        """Return True if any ancestor folder of topic is in shared_resource_ids."""
        current_parent_id = topic.parent_id
        while current_parent_id is not None:
            if str(current_parent_id) in shared_resource_ids:
                return True
            parent = db.query(Topic).filter(Topic.id == current_parent_id).first()
            if parent is None:
                break
            current_parent_id = parent.parent_id
        return False

    def has_share_access(
        self,
        db: Session,
        user_id,
        resource_id,
    ) -> bool:
        """
        Return True if user_id has share access to resource_id.

        Checks:
          1. Direct share: Share record with recipient_id == user_id AND resource_id == resource_id
          2. Ancestor share: any ancestor folder of resource_id has a Share with recipient_id == user_id

        Uses DB queries (not in-memory) to prevent TOCTOU issues.
        """
        # Direct share check
        direct = (
            db.query(Share)
            .filter(
                Share.recipient_id == user_id,
                Share.resource_id == resource_id,
            )
            .first()
        )
        if direct is not None:
            return True

        # Walk ancestor chain and check for an ancestor folder share
        topic = db.query(Topic).filter(Topic.id == resource_id).first()
        if topic is None:
            return False

        current_parent_id = topic.parent_id
        while current_parent_id is not None:
            ancestor_share = (
                db.query(Share)
                .filter(
                    Share.recipient_id == user_id,
                    Share.resource_id == current_parent_id,
                )
                .first()
            )
            if ancestor_share is not None:
                return True

            parent = db.query(Topic).filter(Topic.id == current_parent_id).first()
            if parent is None:
                break
            current_parent_id = parent.parent_id

        return False

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_resource_node(
        self,
        db: Session,
        topic: Topic,
    ) -> SharedResourceNode:
        """
        Recursively build a SharedResourceNode tree rooted at `topic`.
        """
        children: list[SharedResourceNode] = []
        if topic.is_folder:
            child_topics = (
                db.query(Topic)
                .filter(Topic.parent_id == topic.id)
                .all()
            )
            for child in child_topics:
                children.append(self._build_resource_node(db, child))

        return SharedResourceNode(
            id=str(topic.id),
            name=topic.name,
            is_folder=topic.is_folder,
            status=topic.status if not topic.is_folder else None,
            children=children,
        )


# Module-level singleton
sharing_service = SharingService()
