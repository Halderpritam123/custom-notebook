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


class UpdateNoteBody(BaseModel):
    content: str


class CreateCategoryBody(BaseModel):
    name: str
    parent_id: str | None = None


class RenameBody(BaseModel):
    name: str


class UpdateResearchBody(BaseModel):
    summary: str | None = None
    key_concepts: str | None = None
    background_context: str | None = None
    how_it_works: str | None = None
    real_world_applications: str | None = None
    common_misconceptions: str | None = None
    related_topics: str | None = None
    open_questions: str | None = None


class CreateShareBody(BaseModel):
    resource_id: str
    recipient_id: str


class ShareResponse(BaseModel):
    id: str
    resource_id: str
    recipient_id: str
    recipient_email: str
    created_at: str


class UserSearchResult(BaseModel):
    id: str
    email: str


class SharedResourceNode(BaseModel):
    id: str
    name: str
    is_folder: bool
    status: str | None
    children: list["SharedResourceNode"] = []


class SharedWithMeGroup(BaseModel):
    owner_id: str
    owner_email: str
    share_ids: list[str]  # all share IDs from this owner — recipient can leave any/all
    nodes: list[SharedResourceNode]
