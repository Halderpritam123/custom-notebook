"""
cache.py — Redis-backed cache service for topic and topic-tree data.

Keys:
  notebook:topic:{id}           TTL 300 s  (Req 6.4)
  notebook:topic_tree:{user_id} TTL 120 s  (Req 7.4)

Redis errors are caught, logged, and never re-raised to callers (Req 6.5, 7.5).
"""
import json
import logging

import redis

from app.config import REDIS_URL

logger = logging.getLogger(__name__)


class CacheService:
    TOPIC_TTL: int = 300   # seconds (Req 6.4)
    TREE_TTL: int = 120    # seconds (Req 7.4)

    def __init__(self, redis_url: str) -> None:
        self._client: redis.Redis = redis.Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
        )

    # ------------------------------------------------------------------
    # Topic helpers  (key: notebook:topic:{id})
    # ------------------------------------------------------------------

    def get_topic(self, topic_id: str) -> dict | None:
        """Return cached topic dict, or None on miss / Redis error."""
        try:
            raw = self._client.get(f"notebook:topic:{topic_id}")
            if raw is None:
                return None
            return json.loads(raw)
        except redis.RedisError as exc:
            logger.error("cache.get_topic(%s) failed: %s", topic_id, exc)
            return None

    def set_topic(self, topic_id: str, data: dict) -> None:
        """Persist topic dict with TOPIC_TTL; silently continue on Redis error."""
        try:
            self._client.setex(
                f"notebook:topic:{topic_id}",
                self.TOPIC_TTL,
                json.dumps(data),
            )
        except redis.RedisError as exc:
            logger.error("cache.set_topic(%s) failed: %s", topic_id, exc)

    def delete_topic(self, topic_id: str) -> None:
        """Evict topic cache entry; silently continue on Redis error."""
        try:
            self._client.delete(f"notebook:topic:{topic_id}")
        except redis.RedisError as exc:
            logger.error("cache.delete_topic(%s) failed: %s", topic_id, exc)

    # ------------------------------------------------------------------
    # Topic-tree helpers  (key: notebook:topic_tree:{user_id})
    # ------------------------------------------------------------------

    def get_tree(self, user_id: str) -> dict | None:
        """Return cached topic-tree dict, or None on miss / Redis error."""
        try:
            raw = self._client.get(f"notebook:topic_tree:{user_id}")
            if raw is None:
                return None
            return json.loads(raw)
        except redis.RedisError as exc:
            logger.error("cache.get_tree(%s) failed: %s", user_id, exc)
            return None

    def set_tree(self, user_id: str, data: dict) -> None:
        """Persist topic-tree dict with TREE_TTL; silently continue on Redis error."""
        try:
            self._client.setex(
                f"notebook:topic_tree:{user_id}",
                self.TREE_TTL,
                json.dumps(data),
            )
        except redis.RedisError as exc:
            logger.error("cache.set_tree(%s) failed: %s", user_id, exc)

    def delete_tree(self, user_id: str) -> None:
        """Evict topic-tree cache entry; silently continue on Redis error."""
        try:
            self._client.delete(f"notebook:topic_tree:{user_id}")
        except redis.RedisError as exc:
            logger.error("cache.delete_tree(%s) failed: %s", user_id, exc)


# Module-level singleton — import this in routers.
cache: CacheService = CacheService(REDIS_URL)
