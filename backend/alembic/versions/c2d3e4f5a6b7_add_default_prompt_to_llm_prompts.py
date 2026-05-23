"""add default prompt columns to llm_prompts

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-05-23 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'llm_prompts',
        sa.Column('default_user_prompt_template', sa.Text(), nullable=False, server_default=''),
    )
    op.add_column(
        'llm_prompts',
        sa.Column('default_system_prompt', sa.Text(), nullable=True),
    )
    op.execute(
        "UPDATE llm_prompts SET default_user_prompt_template = user_prompt_template "
        "WHERE default_user_prompt_template = ''"
    )
    op.execute(
        "UPDATE llm_prompts SET default_system_prompt = system_prompt "
        "WHERE default_system_prompt IS NULL AND system_prompt IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column('llm_prompts', 'default_system_prompt')
    op.drop_column('llm_prompts', 'default_user_prompt_template')
