"""
shares.py — User search and share CRUD endpoints.

Covers Requirements: 1.1–1.5, 2.1–2.6, 3.1, 5.1–5.6
"""
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.limiter import limiter
from app.core.security import get_current_user
from app.database import get_db
from app.models.models import Share, User
from app.schemas.schemas import (
    CreateShareBody,
    ShareResponse,
    SharedWithMeGroup,
    UserSearchResult,
)
from app.services.sharing import sharing_service
from app.services.cache import cache

router = APIRouter(tags=["shares"])


def _share_to_response(share: Share) -> ShareResponse:
    """Convert a Share ORM object to a ShareResponse schema."""
    return ShareResponse(
        id=str(share.id),
        resource_id=str(share.resource_id),
        recipient_id=str(share.recipient_id),
        recipient_email=share.recipient.email,
        created_at=share.created_at.isoformat() if share.created_at else "",
    )


# ---------------------------------------------------------------------------
# User search
# ---------------------------------------------------------------------------

@router.get("/users/search", response_model=list[UserSearchResult])
@limiter.limit("20/minute")
def search_users(
    request: Request,
    q: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserSearchResult]:
    """
    Search registered users by email (partial, case-insensitive).
    Returns empty list if query is fewer than 2 characters.
    Excludes the requesting user from results.
    """
    if len(q) < 2:
        return []

    users = (
        db.query(User)
        .filter(
            User.email.ilike(f"%{q}%"),
            User.id != current_user.id,
        )
        .all()
    )

    return [UserSearchResult(id=str(u.id), email=u.email) for u in users]


# ---------------------------------------------------------------------------
# Share CRUD
# ---------------------------------------------------------------------------

@router.post("/shares", response_model=ShareResponse, status_code=201)
def create_share(
    body: CreateShareBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ShareResponse:
    """Create a share granting a recipient read access to a resource."""
    share = sharing_service.create_share(
        db,
        owner_id=current_user.id,
        resource_id=body.resource_id,
        recipient_id=body.recipient_id,
    )
    # Ensure the recipient relationship is loaded for email access
    if share.recipient is None:
        db.refresh(share)
    return _share_to_response(share)


@router.get("/shares", response_model=list[ShareResponse])
def list_shares(
    resource_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ShareResponse]:
    """List all shares for a given resource (owner only)."""
    shares = sharing_service.list_shares_for_resource(
        db,
        resource_id=resource_id,
        owner_id=current_user.id,
    )
    return [_share_to_response(s) for s in shares]


@router.delete("/shares/{share_id}", status_code=204)
def revoke_share(
    share_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Revoke a share (owner only). Returns 204 No Content."""
    sharing_service.revoke_share(
        db,
        owner_id=current_user.id,
        share_id=share_id,
    )
    return Response(status_code=204)


@router.delete("/shared-with-me/{share_id}", status_code=204)
def leave_share(
    share_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Recipient removes their own access to a shared resource. Returns 204."""
    from app.models.models import Share as ShareModel
    share = db.query(ShareModel).filter(ShareModel.id == share_id).first()
    if share is None:
        raise HTTPException(status_code=404, detail="Share not found.")
    if str(share.recipient_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied.")
    db.delete(share)
    db.commit()
    cache.delete_tree(str(current_user.id))
    return Response(status_code=204)


@router.get("/shared-with-me", response_model=list[SharedWithMeGroup])
def shared_with_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SharedWithMeGroup]:
    """Return all content shared with the current user, grouped by owner."""
    return sharing_service.get_shared_with_me(db, user_id=current_user.id)
