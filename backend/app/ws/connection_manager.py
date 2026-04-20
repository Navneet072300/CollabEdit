"""
WebSocket Connection Manager + Redis pub/sub fanout.

Why Redis pub/sub?
  In production you run multiple FastAPI workers (or pods). A WebSocket
  connection lives on exactly one worker. When client A (on worker-1)
  sends an op, we need to broadcast it to client B (on worker-2).
  We do this by PUBLISHing to a Redis channel `room:{room_id}` — every
  worker SUBSCRIBEs to that channel and forwards messages to its local
  WebSocket connections. This makes the system horizontally scalable.
"""

import asyncio
import json
import logging
from collections import defaultdict
from fastapi import WebSocket

from app.redis_client import get_redis, new_pubsub_connection

logger = logging.getLogger(__name__)

ROOM_CHANNEL_PREFIX = "room:"


class ConnectionManager:
    def __init__(self):
        # room_id → {user_id: WebSocket}
        self._connections: dict[str, dict[str, WebSocket]] = defaultdict(dict)
        # room_id → asyncio.Task (the Redis subscriber task)
        self._subscriber_tasks: dict[str, asyncio.Task] = {}

    async def connect(self, room_id: str, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[room_id][user_id] = websocket

        # Ensure there's a Redis subscriber running for this room.
        # Only one subscriber per room per process — it fans out locally.
        if room_id not in self._subscriber_tasks:
            task = asyncio.create_task(self._redis_subscriber(room_id))
            self._subscriber_tasks[room_id] = task

    def disconnect(self, room_id: str, user_id: str) -> None:
        self._connections[room_id].pop(user_id, None)
        if not self._connections[room_id]:
            # No more local connections for this room; cancel the subscriber
            task = self._subscriber_tasks.pop(room_id, None)
            if task:
                task.cancel()
            del self._connections[room_id]

    def get_users_in_room(self, room_id: str) -> list[str]:
        return list(self._connections.get(room_id, {}).keys())

    async def send_to_user(self, room_id: str, user_id: str, message: dict) -> None:
        ws = self._connections.get(room_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                logger.warning("Failed to send to user %s in room %s", user_id, room_id)

    async def broadcast_to_room(self, room_id: str, message: dict, exclude_user_id: str | None = None) -> None:
        """Publish via Redis so ALL workers broadcast to their local connections."""
        payload = json.dumps({"message": message, "exclude": exclude_user_id})
        await get_redis().publish(f"{ROOM_CHANNEL_PREFIX}{room_id}", payload)

    async def _redis_subscriber(self, room_id: str) -> None:
        """
        Runs as a background task for each room that has local connections.
        Subscribes to the Redis channel and fans out to local WebSocket clients.
        """
        conn = new_pubsub_connection()
        pubsub = conn.pubsub()
        channel = f"{ROOM_CHANNEL_PREFIX}{room_id}"
        await pubsub.subscribe(channel)
        logger.info("Redis subscriber started for room %s", room_id)

        try:
            async for msg in pubsub.listen():
                if msg["type"] != "message":
                    continue
                try:
                    payload = json.loads(msg["data"])
                    message = payload["message"]
                    exclude = payload.get("exclude")
                    await self._local_broadcast(room_id, message, exclude)
                except Exception as e:
                    logger.error("Error processing Redis message: %s", e)
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(channel)
            await conn.aclose()
            logger.info("Redis subscriber stopped for room %s", room_id)

    async def _local_broadcast(self, room_id: str, message: dict, exclude_user_id: str | None) -> None:
        """Send to all local WebSocket connections in a room."""
        targets = dict(self._connections.get(room_id, {}))
        dead = []
        for uid, ws in targets.items():
            if uid == exclude_user_id:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self._connections[room_id].pop(uid, None)


manager = ConnectionManager()
