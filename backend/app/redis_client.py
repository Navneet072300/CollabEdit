"""
Redis client setup.

Redis protocol requires SEPARATE connections for pub/sub and regular commands.
A connection in subscribe mode can only issue subscribe/unsubscribe commands —
any other command will raise an error. So we maintain two pools.
"""

import redis.asyncio as aioredis
from app.config import settings

# Regular command pool (GET, SET, HSET, EXPIRE, HDEL, PUBLISH, etc.)
redis_pool: aioredis.Redis | None = None

# Pub/sub connection factory — each subscriber gets its own connection
def get_redis() -> aioredis.Redis:
    global redis_pool
    if redis_pool is None:
        redis_pool = aioredis.from_url(settings.redis_url, decode_responses=True)
    return redis_pool


def new_pubsub_connection() -> aioredis.Redis:
    """Return a fresh Redis connection for exclusive use as a subscriber."""
    return aioredis.from_url(settings.redis_url, decode_responses=True)
