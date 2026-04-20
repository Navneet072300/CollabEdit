from datetime import datetime
from pydantic import BaseModel
import uuid


class FileInfo(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    path: str
    name: str
    language: str
    is_folder: bool
    revision: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FileCreate(BaseModel):
    path: str
    name: str
    content: str = ""
    language: str = "plaintext"
    is_folder: bool = False


class FileRename(BaseModel):
    new_path: str
    new_name: str
