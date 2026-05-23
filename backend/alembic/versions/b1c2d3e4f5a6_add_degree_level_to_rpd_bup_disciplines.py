"""add degree_level to rpd_bup_disciplines

Revision ID: b1c2d3e4f5a6
Revises: ed525c931838
Create Date: 2026-05-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'ed525c931838'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('rpd_bup_disciplines', sa.Column('degree_level', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('rpd_bup_disciplines', 'degree_level')
