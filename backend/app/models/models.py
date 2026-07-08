"""
models.py — all SQLAlchemy ORM models.
"""
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Text, types
from sqlalchemy.orm import backref, relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Portable UUID — works with PostgreSQL (native UUID) and SQLite (CHAR36)
# ---------------------------------------------------------------------------
class PortableUUID(types.TypeDecorator):
    impl = types.String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(types.String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            import uuid
            return uuid.UUID(str(value)) if not isinstance(value, uuid.UUID) else value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        import uuid
        return uuid.UUID(str(value)) if not isinstance(value, uuid.UUID) else value


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(PortableUUID, primary_key=True, default=uuid4)
    email = Column(Text, nullable=False, unique=True)
    hashed_password = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    topics = relationship("Topic", back_populates="user", cascade="all, delete-orphan")
    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id = Column(PortableUUID, primary_key=True, default=uuid4)
    user_id = Column(PortableUUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(Text, nullable=False)
    provider_user_id = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="oauth_accounts")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(PortableUUID, primary_key=True, default=uuid4)
    user_id = Column(PortableUUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(PortableUUID, ForeignKey("topics.id", ondelete="CASCADE"), nullable=True, default=None)
    is_folder = Column(Boolean, nullable=False, default=False)
    name = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="researching")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="topics")
    children = relationship(
        "Topic",
        backref=backref("parent", remote_side=[id]),
        cascade="all, delete-orphan",
    )
    research = relationship("Research", back_populates="topic", cascade="all, delete-orphan", uselist=False)
    notes = relationship(
        "SavedNote",
        back_populates="topic",
        cascade="all, delete-orphan",
        order_by="SavedNote.created_at",
    )


Index("ix_topics_user_id", Topic.user_id)
Index("ix_topics_parent_id", Topic.parent_id)


class Research(Base):
    __tablename__ = "research"

    id = Column(PortableUUID, primary_key=True, default=uuid4)
    topic_id = Column(PortableUUID, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    one_liner = Column(Text)
    mechanism = Column(Text)
    when_to_use = Column(Text)
    tradeoffs = Column(Text)
    interview = Column(Text)
    related = Column(Text)
    diagram = Column(Text)

    topic = relationship("Topic", back_populates="research")


class SavedNote(Base):
    __tablename__ = "saved_notes"

    id = Column(PortableUUID, primary_key=True, default=uuid4)
    topic_id = Column(PortableUUID, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    topic = relationship("Topic", back_populates="notes")


Index("ix_saved_notes_topic_id", SavedNote.topic_id)
Index("ix_oauth_accounts_user_id", OAuthAccount.user_id)
