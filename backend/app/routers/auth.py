"""
auth.py — authentication routes (email/password + OAuth).
"""
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import (
    BACKEND_URL, FRONTEND_URL, REGISTRATION_OPEN,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET,
)
from app.core.security import (
    create_access_token, create_password_reset_token, get_current_user,
    hash_password, verify_password, verify_password_reset_token, find_or_create_oauth_user,
)
from app.database import get_db
from app.models.models import User
from app.schemas.schemas import ForgotPasswordBody, LoginBody, RegisterBody, ResetPasswordBody

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/status")
def auth_status() -> dict:
    return {"registration_open": REGISTRATION_OPEN}


@router.post("/register", status_code=201)
def register(body: RegisterBody, db: Session = Depends(get_db)) -> dict:
    if not REGISTRATION_OPEN:
        raise HTTPException(status_code=403, detail="Registrations are temporarily closed.")
    if not body.email or not body.password:
        raise HTTPException(status_code=422, detail="Email and password required")
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(email=body.email.lower(), hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": create_access_token(str(user.id)), "email": user.email}


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": create_access_token(str(user.id)), "email": user.email}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordBody, db: Session = Depends(get_db)) -> dict:
    if not body.email:
        raise HTTPException(status_code=422, detail="Email required")

    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user:
        token = create_password_reset_token(user.email)
        reset_link = f"{FRONTEND_URL}/?reset={quote(token)}"
        return {"message": "Use the link below to reset your password.", "reset_link": reset_link}

    return {"message": "If an account exists for that email, a reset link will be shown.", "reset_link": None}


@router.post("/reset-password")
def reset_password(body: ResetPasswordBody, db: Session = Depends(get_db)) -> dict:
    if not body.token or not body.new_password:
        raise HTTPException(status_code=422, detail="Token and new password required")

    email = verify_password_reset_token(body.token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired reset token")

    user = db.query(User).filter(User.email == email.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)) -> dict:
    return {"id": str(current_user.id), "email": current_user.email}


# ── Google OAuth ──────────────────────────────────────────────────────────────

@router.get("/google")
def google_login():
    params = (
        f"client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={BACKEND_URL}/auth/google/callback"
        f"&response_type=code&scope=openid%20email%20profile&access_type=offline"
    )
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code, "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": f"{BACKEND_URL}/auth/google/callback",
            "grant_type": "authorization_code",
        })
    if resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}?error=google_token_failed")

    access_token = resp.json().get("access_token")
    async with httpx.AsyncClient() as client:
        info_resp = await client.get("https://www.googleapis.com/oauth2/v2/userinfo",
                                     headers={"Authorization": f"Bearer {access_token}"})
    if info_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}?error=google_userinfo_failed")

    info = info_resp.json()
    email, provider_id = info.get("email"), info.get("id")
    if not email or not provider_id:
        return RedirectResponse(f"{FRONTEND_URL}?error=google_missing_fields")

    user = find_or_create_oauth_user(db, "google", provider_id, email, REGISTRATION_OPEN)
    if user is None:
        return RedirectResponse(f"{FRONTEND_URL}?error=registration_closed")
    token = create_access_token(str(user.id))
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?token={token}&email={email}")


# ── GitHub OAuth ──────────────────────────────────────────────────────────────

@router.get("/github")
def github_login():
    params = (f"client_id={GITHUB_CLIENT_ID}"
              f"&redirect_uri={BACKEND_URL}/auth/github/callback&scope=user:email")
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{params}")


@router.get("/github/callback")
async def github_callback(code: str, db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://github.com/login/oauth/access_token",
                                 headers={"Accept": "application/json"},
                                 data={"client_id": GITHUB_CLIENT_ID, "client_secret": GITHUB_CLIENT_SECRET,
                                       "code": code, "redirect_uri": f"{BACKEND_URL}/auth/github/callback"})
    if resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}?error=github_token_failed")

    access_token = resp.json().get("access_token")
    async with httpx.AsyncClient() as client:
        user_resp = await client.get("https://api.github.com/user",
                                     headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"})
    if user_resp.status_code != 200:
        return RedirectResponse(f"{FRONTEND_URL}?error=github_userinfo_failed")

    data = user_resp.json()
    provider_id = data.get("id")
    email = data.get("email")

    if not email:
        async with httpx.AsyncClient() as client:
            emails_resp = await client.get("https://api.github.com/user/emails",
                                           headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"})
        if emails_resp.status_code == 200:
            email = next(
                (e["email"] for e in emails_resp.json() if e.get("primary") and e.get("verified")), None
            )

    if not email or not provider_id:
        return RedirectResponse(f"{FRONTEND_URL}?error=github_missing_fields")

    user = find_or_create_oauth_user(db, "github", str(provider_id), email, REGISTRATION_OPEN)
    if user is None:
        return RedirectResponse(f"{FRONTEND_URL}?error=registration_closed")
    token = create_access_token(str(user.id))
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?token={token}&email={email}")
