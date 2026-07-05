"""
auth.py — JWT, password hashing, and OAuth utilities.
"""

import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

try:
    from backend.database import OAuthAccount, User, get_db
except ModuleNotFoundError:
    from database import OAuthAccount, User, get_db

SECRET_KEY = os.getenv("JWT_SECRET", "fallback-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def find_or_create_oauth_user(
    db: Session,
    provider: str,
    provider_user_id: str,
    email: str,
    registration_open: bool = True,
) -> User | None:
    """Find or create a user from OAuth provider data.

    Returns None if the user doesn't exist and registration is closed.
    """
    # 1. Check existing OAuth link
    oauth = (
        db.query(OAuthAccount)
        .filter(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == str(provider_user_id),
        )
        .first()
    )
    if oauth:
        return oauth.user

    # 2. Check for existing user by email
    user = db.query(User).filter(User.email == email.lower()).first()
    if user:
        # Existing user — link OAuth account
        oauth_account = OAuthAccount(
            user_id=user.id,
            provider=provider,
            provider_user_id=str(provider_user_id),
        )
        db.add(oauth_account)
        db.commit()
        return user

    # 3. New user — check if registration is open
    if not registration_open:
        return None

    user = User(email=email.lower(), hashed_password=None)
    db.add(user)
    db.commit()
    db.refresh(user)

    oauth_account = OAuthAccount(
        user_id=user.id,
        provider=provider,
        provider_user_id=str(provider_user_id),
    )
    db.add(oauth_account)
    db.commit()
    return user
