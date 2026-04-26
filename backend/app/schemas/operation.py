from typing import Literal
from pydantic import BaseModel


class OperationSchema(BaseModel):
    op_type: Literal["insert", "delete"]
    position: int
    text: str | None = None    # for insert
    length: int | None = None  # for delete


# ── Discriminated WebSocket message union ──────────────────────────────────────
# Every message on the wire must match one of these shapes.

class OpMessage(BaseModel):
    type: Literal["op"]
    op: OperationSchema
    revision: int        # client's last known server revision
    user_id: str
    user_name: str


class AckMessage(BaseModel):
    type: Literal["ack"]
    revision: int        # new server revision after applying this op


class SyncMessage(BaseModel):
    type: Literal["sync"]
    content: str
    revision: int
    language: str


class PresenceUpdate(BaseModel):
    line: int
    ch: int
    selection_from: dict[str, int] | None = None
    selection_to: dict[str, int] | None = None


class PresenceMessage(BaseModel):
    type: Literal["presence"]
    user_id: str
    user_name: str
    color: str
    cursor: PresenceUpdate | None = None


class PresenceLeaveMessage(BaseModel):
    type: Literal["presence_leave"]
    user_id: str


class LanguageChangeMessage(BaseModel):
    type: Literal["language_change"]
    language: str
    user_id: str


class RoomUpdateMessage(BaseModel):
    type: Literal["room_update"]
    name: str | None = None


class RemoteOpMessage(BaseModel):
    """Op broadcast to other clients (server→client), includes who sent it."""
    type: Literal["remote_op"]
    op: OperationSchema
    revision: int
    user_id: str
    user_name: str


WSMessage = (
    OpMessage
    | AckMessage
    | SyncMessage
    | PresenceMessage
    | PresenceLeaveMessage
    | LanguageChangeMessage
    | RoomUpdateMessage
    | RemoteOpMessage
)
