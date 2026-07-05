"""
database.py — SQLAlchemy models and engine configuration for AI Notebook.

The engine is configured from the DATABASE_URL environment variable.
UUID columns use a TypeDecorator so the same model works with both
PostgreSQL (native UUID type) and SQLite (stored as CHAR(36) string),
which is needed for in-memory test databases.
"""

import os
from datetime import datetime, timezone
from uuid import uuid4

from dotenv import load_dotenv
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Text,
    create_engine,
    types,
)
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///:memory:")

# ---------------------------------------------------------------------------
# Engine — echo=False keeps logs clean; future=True opts into SQLAlchemy 2.x
# ---------------------------------------------------------------------------
engine = create_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,        # test connection before use — reconnects if dead
    pool_recycle=300,          # recycle connections every 5 minutes
    pool_size=5,
    max_overflow=10,
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


# ---------------------------------------------------------------------------
# Portable UUID column type
# ---------------------------------------------------------------------------
class PortableUUID(types.TypeDecorator):
    """Stores UUIDs as native UUID on PostgreSQL and as CHAR(36) on SQLite.

    This lets the same ORM models run against both databases without
    any model-level changes.
    """

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
            # psycopg2 accepts Python uuid.UUID objects directly
            import uuid

            return uuid.UUID(str(value)) if not isinstance(value, uuid.UUID) else value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        import uuid

        return uuid.UUID(str(value)) if not isinstance(value, uuid.UUID) else value


# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# ORM Models
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id = Column(PortableUUID, primary_key=True, default=uuid4)
    email = Column(Text, nullable=False, unique=True)
    hashed_password = Column(Text, nullable=True)   # null for OAuth-only users
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    topics = relationship("Topic", back_populates="user", cascade="all, delete-orphan")
    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id = Column(PortableUUID, primary_key=True, default=uuid4)
    user_id = Column(PortableUUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(Text, nullable=False)          # "google" | "github"
    provider_user_id = Column(Text, nullable=False)  # ID from the provider
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="oauth_accounts")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(PortableUUID, primary_key=True, default=uuid4)
    user_id = Column(PortableUUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="researching")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="topics")

    # One-to-one relationship with Research; cascade deletes the research row
    research = relationship(
        "Research",
        back_populates="topic",
        cascade="all, delete-orphan",
        uselist=False,
    )

    # One-to-many relationship with SavedNote; cascade deletes all note rows
    notes = relationship(
        "SavedNote",
        back_populates="topic",
        cascade="all, delete-orphan",
    )


class Research(Base):
    __tablename__ = "research"

    id = Column(PortableUUID, primary_key=True, default=uuid4)
    topic_id = Column(
        PortableUUID,
        ForeignKey("topics.id", ondelete="CASCADE"),
        nullable=False,
    )
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
    topic_id = Column(
        PortableUUID,
        ForeignKey("topics.id", ondelete="CASCADE"),
        nullable=False,
    )
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    topic = relationship("Topic", back_populates="notes")


# ---------------------------------------------------------------------------
# Table creation utility
# ---------------------------------------------------------------------------


def create_all_tables() -> None:
    """Create all tables defined in the SQLAlchemy metadata.

    Called once on application startup (via FastAPI's lifespan or an
    explicit call in main.py).  Safe to call repeatedly — SQLAlchemy
    only creates tables that do not already exist.
    """
    Base.metadata.create_all(engine)


# ---------------------------------------------------------------------------
# FastAPI session dependency
# ---------------------------------------------------------------------------


def get_db():
    """Yield a SQLAlchemy session and guarantee it is closed afterwards.

    Usage in a route::

        @app.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
