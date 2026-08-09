"""
Property-based tests for CacheService (Properties 12–16).

Feature: topic-sharing-and-caching
Validates: Requirements 6.1–6.5, 7.1–7.5

Each test mocks the underlying Redis client so no live Redis instance is needed.
"""
import json
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
import redis
from hypothesis import given, settings
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Hypothesis settings — 100 examples per property
# ---------------------------------------------------------------------------
settings.register_profile("ci", max_examples=100)
settings.load_profile("ci")


# ---------------------------------------------------------------------------
# Helpers / strategies
# ---------------------------------------------------------------------------

# Printable text that avoids surrogates (valid for Redis keys / JSON values).
safe_text = st.text(
    alphabet=st.characters(blacklist_categories=("Cs",), blacklist_characters="\x00"),
    min_size=1,
    max_size=50,
)

data_strategy = st.fixed_dictionaries(
    {
        "id": safe_text,
        "name": safe_text,
        "status": st.sampled_from(["active", "pending", "done"]),
    }
)


def _make_cache(redis_url: str = "redis://localhost:6379") -> "CacheService":  # noqa: F821
    """Import-here to avoid module-level Redis connection at import time."""
    from app.services.cache import CacheService
    return CacheService(redis_url)


# ---------------------------------------------------------------------------
# Property 12: Cache read-hit returns cached value without DB query
# Validates: Requirements 6.1, 7.1
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(topic_id=safe_text, data=data_strategy)
def test_cache_hit_no_db_query_topic(topic_id: str, data: dict) -> None:
    """
    Feature: topic-sharing-and-caching, Property 12: Cache read-hit returns cached value.

    When get_topic is called and the Redis key exists, the service must return
    the cached value directly without any external DB call.
    """
    cache = _make_cache()

    with patch.object(cache, "_client") as mock_client:
        mock_client.get.return_value = json.dumps(data)

        result = cache.get_topic(topic_id)

    assert result == data
    mock_client.get.assert_called_once_with(f"notebook:topic:{topic_id}")
    # No setex / other calls — only the single .get
    mock_client.setex.assert_not_called()


@settings(max_examples=100)
@given(user_id=safe_text, data=data_strategy)
def test_cache_hit_no_db_query_tree(user_id: str, data: dict) -> None:
    """
    Feature: topic-sharing-and-caching, Property 12: Cache read-hit returns cached value.

    When get_tree is called and the Redis key exists, the service must return
    the cached value without any external DB call.
    """
    cache = _make_cache()

    with patch.object(cache, "_client") as mock_client:
        mock_client.get.return_value = json.dumps(data)

        result = cache.get_tree(user_id)

    assert result == data
    mock_client.get.assert_called_once_with(f"notebook:topic_tree:{user_id}")
    mock_client.setex.assert_not_called()


# ---------------------------------------------------------------------------
# Property 13: Cache read-miss — set uses correct TTL
# Validates: Requirements 6.2, 6.4, 7.2, 7.4
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(topic_id=safe_text, data=data_strategy)
def test_cache_miss_set_topic_uses_correct_ttl(topic_id: str, data: dict) -> None:
    """
    Feature: topic-sharing-and-caching, Property 13: Cache read-miss populates with correct TTL.

    When set_topic is called, it must store the value with TTL == 300 s (TOPIC_TTL).
    """
    from app.services.cache import CacheService

    cache = _make_cache()

    with patch.object(cache, "_client") as mock_client:
        # Simulate a cache miss: get returns None
        mock_client.get.return_value = None

        # The router would normally call set_topic after fetching from DB.
        cache.set_topic(topic_id, data)

    mock_client.setex.assert_called_once_with(
        f"notebook:topic:{topic_id}",
        CacheService.TOPIC_TTL,   # must be exactly 300
        json.dumps(data),
    )
    assert CacheService.TOPIC_TTL == 300


@settings(max_examples=100)
@given(user_id=safe_text, data=data_strategy)
def test_cache_miss_set_tree_uses_correct_ttl(user_id: str, data: dict) -> None:
    """
    Feature: topic-sharing-and-caching, Property 13: Cache read-miss populates with correct TTL.

    When set_tree is called, it must store the value with TTL == 120 s (TREE_TTL).
    """
    from app.services.cache import CacheService

    cache = _make_cache()

    with patch.object(cache, "_client") as mock_client:
        mock_client.get.return_value = None

        cache.set_tree(user_id, data)

    mock_client.setex.assert_called_once_with(
        f"notebook:topic_tree:{user_id}",
        CacheService.TREE_TTL,   # must be exactly 120
        json.dumps(data),
    )
    assert CacheService.TREE_TTL == 120


# ---------------------------------------------------------------------------
# Property 14: Write operations invalidate topic cache
# Validates: Requirements 6.3
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(topic_id=safe_text, data=data_strategy)
def test_write_invalidates_topic_cache(topic_id: str, data: dict) -> None:
    """
    Feature: topic-sharing-and-caching, Property 14: Write operations invalidate topic cache.

    After set_topic followed by delete_topic, a subsequent get_topic must return None
    (simulating that the key no longer exists in Redis).
    """
    cache = _make_cache()

    with patch.object(cache, "_client") as mock_client:
        # After delete, simulate key is gone
        mock_client.get.return_value = None

        cache.set_topic(topic_id, data)
        cache.delete_topic(topic_id)
        result = cache.get_topic(topic_id)

    mock_client.setex.assert_called_once()
    mock_client.delete.assert_called_once_with(f"notebook:topic:{topic_id}")
    assert result is None


# ---------------------------------------------------------------------------
# Property 15: Structural changes invalidate topic-tree cache
# Validates: Requirements 7.3
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(user_id=safe_text, data=data_strategy)
def test_structural_change_invalidates_tree_cache(user_id: str, data: dict) -> None:
    """
    Feature: topic-sharing-and-caching, Property 15: Structural changes invalidate topic-tree cache.

    After set_tree followed by delete_tree, a subsequent get_tree must return None.
    """
    cache = _make_cache()

    with patch.object(cache, "_client") as mock_client:
        mock_client.get.return_value = None

        cache.set_tree(user_id, data)
        cache.delete_tree(user_id)
        result = cache.get_tree(user_id)

    mock_client.setex.assert_called_once()
    mock_client.delete.assert_called_once_with(f"notebook:topic_tree:{user_id}")
    assert result is None


# ---------------------------------------------------------------------------
# Property 16: Redis unavailability falls through — no exception raised
# Validates: Requirements 6.5, 7.5
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(topic_id=safe_text, data=data_strategy)
def test_redis_unavailable_get_topic_returns_none(topic_id: str, data: dict) -> None:
    """
    Feature: topic-sharing-and-caching, Property 16: Redis unavailability falls through.

    When Redis raises RedisError on get, get_topic must return None without
    propagating the exception.
    """
    cache = _make_cache()

    with patch.object(cache, "_client") as mock_client:
        mock_client.get.side_effect = redis.RedisError("connection refused")

        result = cache.get_topic(topic_id)

    assert result is None


@settings(max_examples=100)
@given(topic_id=safe_text, data=data_strategy)
def test_redis_unavailable_set_topic_does_not_raise(topic_id: str, data: dict) -> None:
    """
    Feature: topic-sharing-and-caching, Property 16: Redis unavailability falls through.

    When Redis raises RedisError on setex, set_topic must not raise any exception.
    """
    cache = _make_cache()

    with patch.object(cache, "_client") as mock_client:
        mock_client.setex.side_effect = redis.RedisError("connection refused")

        # Must not raise
        cache.set_topic(topic_id, data)


@settings(max_examples=100)
@given(topic_id=safe_text)
def test_redis_unavailable_delete_topic_does_not_raise(topic_id: str) -> None:
    """
    Feature: topic-sharing-and-caching, Property 16: Redis unavailability falls through.

    When Redis raises RedisError on delete, delete_topic must not raise any exception.
    """
    cache = _make_cache()

    with patch.object(cache, "_client") as mock_client:
        mock_client.delete.side_effect = redis.RedisError("connection refused")

        # Must not raise
        cache.delete_topic(topic_id)


@settings(max_examples=100)
@given(user_id=safe_text, data=data_strategy)
def test_redis_unavailable_get_tree_returns_none(user_id: str, data: dict) -> None:
    """
    Feature: topic-sharing-and-caching, Property 16: Redis unavailability falls through.

    When Redis raises RedisError on get, get_tree must return None without
    propagating the exception.
    """
    cache = _make_cache()

    with patch.object(cache, "_client") as mock_client:
        mock_client.get.side_effect = redis.RedisError("connection refused")

        result = cache.get_tree(user_id)

    assert result is None


@settings(max_examples=100)
@given(user_id=safe_text, data=data_strategy)
def test_redis_unavailable_set_tree_does_not_raise(user_id: str, data: dict) -> None:
    """
    Feature: topic-sharing-and-caching, Property 16: Redis unavailability falls through.

    When Redis raises RedisError on setex, set_tree must not raise any exception.
    """
    cache = _make_cache()

    with patch.object(cache, "_client") as mock_client:
        mock_client.setex.side_effect = redis.RedisError("connection refused")

        # Must not raise
        cache.set_tree(user_id, data)


@settings(max_examples=100)
@given(user_id=safe_text)
def test_redis_unavailable_delete_tree_does_not_raise(user_id: str) -> None:
    """
    Feature: topic-sharing-and-caching, Property 16: Redis unavailability falls through.

    When Redis raises RedisError on delete, delete_tree must not raise any exception.
    """
    cache = _make_cache()

    with patch.object(cache, "_client") as mock_client:
        mock_client.delete.side_effect = redis.RedisError("connection refused")

        # Must not raise
        cache.delete_tree(user_id)
