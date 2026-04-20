from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from nanoid import generate

from app.database import get_db
from app.models.room import Room
from app.models.file import File
from app.schemas.room import RoomCreate, RoomResponse, RoomUpdate
from app.utils.language import language_from_path

router = APIRouter(prefix="/api/rooms", tags=["rooms"])

NANOID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

LANG_DEFAULT_FILE = {
    "python": "main.py", "javascript": "index.js", "typescript": "index.ts",
    "html": "index.html", "css": "style.css", "json": "data.json",
    "markdown": "README.md", "rust": "main.rs", "go": "main.go",
    "c": "main.c", "cpp": "main.cpp", "java": "Main.java",
    "ruby": "main.rb", "sql": "query.sql", "csharp": "Program.cs",
}


@router.post("", response_model=RoomResponse, status_code=201)
async def create_room(body: RoomCreate, db: AsyncSession = Depends(get_db)):
    code = generate(NANOID_ALPHABET, 8)
    room = Room(code=code, name=body.name, language=body.language)
    db.add(room)
    await db.flush()  # get room.id before creating file

    # Create the default file for this room
    filename = LANG_DEFAULT_FILE.get(body.language, "main.txt")
    default_file = File(
        room_id=room.id,
        path=filename,
        name=filename,
        content="",
        language=body.language,
        is_folder=False,
    )
    db.add(default_file)
    await db.commit()
    await db.refresh(room)
    return room


@router.get("/{code}", response_model=RoomResponse)
async def get_room(code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Room).where(Room.code == code))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


@router.put("/{room_id}", response_model=RoomResponse)
async def update_room(room_id: str, body: RoomUpdate, db: AsyncSession = Depends(get_db)):
    room = await db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if body.name is not None:
        room.name = body.name
    if body.language is not None:
        room.language = body.language
    await db.commit()
    await db.refresh(room)
    return room
