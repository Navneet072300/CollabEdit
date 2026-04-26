"""
WebSocket handler — file-aware OT.

Each op now carries a file_id. OT state (revision, concurrent ops) is
scoped to the individual file, not the room.
"""

import json
import logging
import uuid

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.room import Room
from app.models.file import File
from app.models.operation import Operation
from app.ot.transform import Op, transform, apply_op
from app.ws.connection_manager import manager
from app.redis_client import get_redis
from app.config import settings
from app.utils.colors import user_color

logger = logging.getLogger(__name__)
PRESENCE_TTL = 30


async def handle_websocket(
    websocket: WebSocket,
    room_id: str,
    user_id: str,
    user_name: str,
    db: AsyncSession,
) -> None:
    await manager.connect(room_id, user_id, websocket)
    color = user_color(user_id)

    try:
        room = await db.get(Room, room_id)
        if not room:
            await websocket.close(code=4004, reason="Room not found")
            return

        # Send the full file tree so client can populate the sidebar
        files = await _get_file_tree(room_id, db)
        await websocket.send_json({"type": "file_tree", "files": files})

        # Auto-open the first file
        if files:
            first = next((f for f in files if not f["is_folder"]), None)
            if first:
                await _send_file_sync(websocket, first["id"], db)

        # Presence
        await _set_presence(room_id, user_id, user_name, color, None)
        await manager.broadcast_to_room(room_id, {
            "type": "presence", "user_id": user_id,
            "user_name": user_name, "color": color, "cursor": None,
        })
        for p in await _get_all_presence(room_id):
            if p["user_id"] != user_id:
                await websocket.send_json({"type": "presence", **p})

        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            t = msg.get("type")

            if t == "op":
                await _handle_op(msg, room_id, user_id, user_name, color, db)
            elif t == "join_file":
                await _send_file_sync(websocket, msg["file_id"], db)
            elif t == "presence":
                await _set_presence(room_id, user_id, user_name, color, msg.get("cursor"))
                await manager.broadcast_to_room(room_id, {
                    "type": "presence", "user_id": user_id,
                    "user_name": user_name, "color": color,
                    "cursor": msg.get("cursor"),
                }, exclude_user_id=user_id)
            elif t == "language_change":
                await _handle_language_change(msg, room_id, user_id, db)
            elif t == "room_update":
                if msg.get("name"):
                    await _handle_room_rename(msg["name"], room_id, db)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WS error user=%s room=%s: %s", user_id, room_id, e)
    finally:
        manager.disconnect(room_id, user_id)
        await _remove_presence(room_id, user_id)
        await manager.broadcast_to_room(room_id, {"type": "presence_leave", "user_id": user_id})


async def _send_file_sync(websocket: WebSocket, file_id: str, db: AsyncSession) -> None:
    f = await db.get(File, uuid.UUID(file_id))
    if f:
        await websocket.send_json({
            "type": "file_sync",
            "file_id": str(f.id),
            "content": f.content,
            "revision": f.revision,
            "language": f.language,
        })


async def _handle_op(msg: dict, room_id: str, user_id: str, user_name: str, color: str, db: AsyncSession) -> None:
    file_id_str = msg.get("file_id")
    if not file_id_str:
        return

    file_id = uuid.UUID(file_id_str)
    client_revision = msg["revision"]
    raw = msg["op"]
    incoming = Op(op_type=raw["op_type"], position=raw["position"],
                  text=raw.get("text"), length=raw.get("length"))

    # Fetch concurrent ops for THIS file since client's revision
    result = await db.execute(
        select(Operation).where(
            Operation.file_id == file_id,
            Operation.revision > client_revision,
        ).order_by(Operation.revision)
    )
    concurrent = result.scalars().all()

    transformed = incoming
    for srv_op in concurrent:
        transformed = transform(transformed, Op(
            op_type=srv_op.op_type, position=srv_op.position,
            text=srv_op.text, length=srv_op.length,
        ))

    f = await db.get(File, file_id)
    if not f or str(f.room_id) != room_id:
        return

    f.content = apply_op(f.content, transformed)
    f.revision += 1
    new_revision = f.revision

    db.add(Operation(
        room_id=uuid.UUID(room_id),
        file_id=file_id,
        revision=new_revision,
        user_id=user_id,
        user_name=user_name,
        op_type=transformed.op_type,
        position=transformed.position,
        text=transformed.text,
        length=transformed.length,
    ))
    await db.commit()
    await _prune_ops(file_id, new_revision, db)

    await manager.send_to_user(room_id, user_id, {"type": "ack", "file_id": file_id_str, "revision": new_revision})
    await manager.broadcast_to_room(room_id, {
        "type": "remote_op",
        "file_id": file_id_str,
        "op": {"op_type": transformed.op_type, "position": transformed.position,
               "text": transformed.text, "length": transformed.length},
        "revision": new_revision,
        "user_id": user_id,
        "user_name": user_name,
        "color": color,
    }, exclude_user_id=user_id)


async def _handle_language_change(msg: dict, room_id: str, user_id: str, db: AsyncSession) -> None:
    file_id_str = msg.get("file_id")
    lang = msg.get("language", "plaintext")
    if file_id_str:
        f = await db.get(File, uuid.UUID(file_id_str))
        if f and str(f.room_id) == room_id:
            f.language = lang
            await db.commit()
    await manager.broadcast_to_room(room_id, {
        "type": "language_change", "language": lang,
        "file_id": file_id_str, "user_id": user_id,
    })


async def _handle_room_rename(name: str, room_id: str, db: AsyncSession) -> None:
    room = await db.get(Room, room_id)
    if room:
        room.name = name
        await db.commit()
    await manager.broadcast_to_room(room_id, {"type": "room_update", "name": name})


async def _prune_ops(file_id: uuid.UUID, current_revision: int, db: AsyncSession) -> None:
    cutoff = current_revision - settings.max_ops_per_room
    if cutoff > 0:
        await db.execute(
            delete(Operation).where(Operation.file_id == file_id, Operation.revision <= cutoff)
        )
        await db.commit()


async def _get_file_tree(room_id: str, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(File).where(File.room_id == room_id).order_by(File.path)
    )
    return [
        {
            "id": str(f.id), "room_id": str(f.room_id), "path": f.path,
            "name": f.name, "language": f.language,
            "is_folder": f.is_folder, "revision": f.revision,
            "created_at": f.created_at.isoformat(), "updated_at": f.updated_at.isoformat(),
        }
        for f in result.scalars().all()
    ]


async def _set_presence(room_id, user_id, user_name, color, cursor):
    redis = get_redis()
    data = json.dumps({"user_id": user_id, "user_name": user_name, "color": color, "cursor": cursor})
    await redis.hset(f"presence:{room_id}", user_id, data)
    await redis.expire(f"presence:{room_id}", PRESENCE_TTL)


async def _remove_presence(room_id, user_id):
    await get_redis().hdel(f"presence:{room_id}", user_id)


async def _get_all_presence(room_id) -> list[dict]:
    raw = await get_redis().hgetall(f"presence:{room_id}")
    result = []
    for v in raw.values():
        try:
            result.append(json.loads(v))
        except Exception:
            pass
    return result
