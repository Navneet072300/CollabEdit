"""Add files table and make operations file-scoped

Revision ID: 002
Revises: 001
Create Date: 2024-01-02 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("path", sa.String(500), nullable=False),      # full path: "src/main.py"
        sa.Column("name", sa.String(200), nullable=False),       # filename only: "main.py"
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("language", sa.String(20), nullable=False, server_default="plaintext"),
        sa.Column("is_folder", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("room_id", "path", name="uq_file_room_path"),
    )
    op.create_index("idx_files_room", "files", ["room_id"])

    # Add file_id to operations (nullable — old ops stay room-scoped)
    op.add_column("operations", sa.Column(
        "file_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("files.id", ondelete="CASCADE"),
        nullable=True,
    ))
    op.create_index("idx_operations_file_revision", "operations", ["file_id", "revision"])

    # Migrate existing room content into a default file per room
    op.execute("""
        INSERT INTO files (room_id, path, name, content, language, revision)
        SELECT id, 'main.' || CASE language
            WHEN 'python'     THEN 'py'
            WHEN 'javascript' THEN 'js'
            WHEN 'typescript' THEN 'ts'
            WHEN 'go'         THEN 'go'
            WHEN 'rust'       THEN 'rs'
            WHEN 'html'       THEN 'html'
            WHEN 'css'        THEN 'css'
            WHEN 'json'       THEN 'json'
            WHEN 'markdown'   THEN 'md'
            ELSE 'txt'
        END,
        'main.' || CASE language
            WHEN 'python'     THEN 'py'
            WHEN 'javascript' THEN 'js'
            WHEN 'typescript' THEN 'ts'
            WHEN 'go'         THEN 'go'
            WHEN 'rust'       THEN 'rs'
            WHEN 'html'       THEN 'html'
            WHEN 'css'        THEN 'css'
            WHEN 'json'       THEN 'json'
            WHEN 'markdown'   THEN 'md'
            ELSE 'txt'
        END,
        content, language, revision
        FROM rooms
        WHERE content != '' OR revision > 0
    """)


def downgrade() -> None:
    op.drop_index("idx_operations_file_revision", "operations")
    op.drop_column("operations", "file_id")
    op.drop_index("idx_files_room", "files")
    op.drop_table("files")
