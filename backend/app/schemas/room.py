from datetime import datetime
from pydantic import BaseModel
import uuid


class RoomCreate(BaseModel):
    name: str
    language: str = "python"


class RoomUpdate(BaseModel):
    name: str | None = None
    language: str | None = None


class RoomResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    language: str
    content: str
    revision: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
