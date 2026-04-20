from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import uuid

from app.database import get_db
from app.models.file import File
from app.models.room import Room
from app.schemas.file import FileInfo, FileCreate, FileRename
from app.utils.language import language_from_path
from app.ws.connection_manager import manager

router = APIRouter(prefix="/api/rooms/{room_id}/files", tags=["files"])


@router.get("", response_model=list[FileInfo])
async def list_files(room_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(File).where(File.room_id == room_id).order_by(File.path)
    )
    return result.scalars().all()


@router.post("", response_model=FileInfo, status_code=201)
async def create_file(room_id: uuid.UUID, body: FileCreate, db: AsyncSession = Depends(get_db)):
    room = await db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")

    # Check for duplicate path
    existing = await db.execute(
        select(File).where(File.room_id == room_id, File.path == body.path)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Path already exists: {body.path}")

    language = body.language if body.is_folder else language_from_path(body.path)
    f = File(
        room_id=room_id,
        path=body.path,
        name=body.name,
        content=body.content,
        language=language,
        is_folder=body.is_folder,
    )
    db.add(f)
    await db.commit()
    await db.refresh(f)

    # Broadcast to room so all clients update their file tree
    await manager.broadcast_to_room(str(room_id), {
        "type": "file_created",
        "file": {
            "id": str(f.id), "room_id": str(f.room_id), "path": f.path,
            "name": f.name, "language": f.language,
            "is_folder": f.is_folder, "revision": f.revision,
            "created_at": f.created_at.isoformat(), "updated_at": f.updated_at.isoformat(),
        },
    })
    return f


@router.get("/{file_id}", response_model=FileInfo)
async def get_file(room_id: uuid.UUID, file_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    f = await db.get(File, file_id)
    if not f or f.room_id != room_id:
        raise HTTPException(404, "File not found")
    return f


@router.patch("/{file_id}/rename", response_model=FileInfo)
async def rename_file(room_id: uuid.UUID, file_id: uuid.UUID, body: FileRename, db: AsyncSession = Depends(get_db)):
    f = await db.get(File, file_id)
    if not f or f.room_id != room_id:
        raise HTTPException(404, "File not found")

    old_path = f.path
    f.path = body.new_path
    f.name = body.new_name
    if not f.is_folder:
        f.language = language_from_path(body.new_path)

    # If it's a folder, cascade-rename all children
    if f.is_folder:
        result = await db.execute(
            select(File).where(File.room_id == room_id, File.path.startswith(old_path + "/"))
        )
        for child in result.scalars().all():
            child.path = body.new_path + child.path[len(old_path):]

    await db.commit()
    await db.refresh(f)

    await manager.broadcast_to_room(str(room_id), {
        "type": "file_renamed",
        "file_id": str(file_id),
        "old_path": old_path,
        "new_path": body.new_path,
        "new_name": body.new_name,
    })
    return f


@router.delete("/{file_id}", status_code=204)
async def delete_file(room_id: uuid.UUID, file_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    f = await db.get(File, file_id)
    if not f or f.room_id != room_id:
        raise HTTPException(404, "File not found")

    # Delete folder children too
    if f.is_folder:
        await db.execute(
            delete(File).where(File.room_id == room_id, File.path.startswith(f.path + "/"))
        )

    await db.delete(f)
    await db.commit()

    await manager.broadcast_to_room(str(room_id), {
        "type": "file_deleted",
        "file_id": str(file_id),
    })
