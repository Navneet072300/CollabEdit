from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, func, BigInteger, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid

from app.database import Base

if TYPE_CHECKING:
    from app.models.room import Room
    from app.models.file import File


class Operation(Base):
    __tablename__ = "operations"
    __table_args__ = (UniqueConstraint("room_id", "revision", name="uq_room_revision"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"))
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    user_name: Mapped[str] = mapped_column(String(50), nullable=False)
    op_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'insert' or 'delete'
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    length: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"), nullable=True)

    room: Mapped["Room"] = relationship("Room", back_populates="operations", foreign_keys=[room_id])
    file: Mapped["File | None"] = relationship("File", back_populates="operations", foreign_keys=[file_id])
