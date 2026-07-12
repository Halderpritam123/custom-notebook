"""
limiter.py — shared SlowAPI rate limiter instance, keyed by authenticated user ID.
"""
from fastapi import Request
from slowapi import Limiter


def get_user_id(request: Request) -> str:
    """Extract user ID from the request state (set by get_current_user dependency)."""
    user = getattr(request.state, "current_user", None)
    if user is None:
        # fallback for unauthenticated routes — use IP
        return request.client.host
    return str(user.id)


limiter = Limiter(key_func=get_user_id)
