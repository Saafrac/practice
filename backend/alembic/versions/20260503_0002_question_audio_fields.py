"""add question audio fields

Revision ID: 20260503_0002
Revises: 20260429_0001
Create Date: 2026-05-03
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260503_0002"
down_revision: str | None = "20260429_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("questions", sa.Column("audio_url", sa.String(length=500), nullable=True))
    op.add_column("questions", sa.Column("transcript", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("questions", "transcript")
    op.drop_column("questions", "audio_url")
