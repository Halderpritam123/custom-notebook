"""
schemas.py — Pydantic request/response models.
"""
from typing import Any
from pydantic import BaseModel


class RegisterBody(BaseModel):
    email: str
    password: str


class LoginBody(BaseModel):
    email: str
    password: str


class ForgotPasswordBody(BaseModel):
    email: str


class ResetPasswordBody(BaseModel):
    token: str
    new_password: str


class CreateTopicBody(BaseModel):
    name: str
    parent_id: str | None = None


class UpdateStatusBody(BaseModel):
    status: str


class ChatBody(BaseModel):
    message: str
    history: list[dict[str, Any]] = []


class CreateNoteBody(BaseModel):
    content: str


class CreateCategoryBody(BaseModel):
    name: str


class RenameBody(BaseModel):
    name: str
