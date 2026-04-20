"""Initial schema: rooms and operations tables

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        "rooms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(8), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("language", sa.String(20), nullable=False, server_default="python"),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "operations",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("user_name", sa.String(50), nullable=False),
        sa.Column("op_type", sa.String(10), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("length", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("room_id", "revision", name="uq_room_revision"),
    )

    op.create_index("idx_operations_room_revision", "operations", ["room_id", "revision"])


def downgrade() -> None:
    op.drop_index("idx_operations_room_revision", "operations")
    op.drop_table("operations")
    op.drop_table("rooms")
