"""scope learning outcomes per rpd_bup_discipline

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-05-23 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'rpd_learning_outcomes',
        sa.Column('id_rpd_bup_discipline', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_rpd_learning_outcomes_rpd_bup_discipline',
        'rpd_learning_outcomes',
        'rpd_bup_disciplines',
        ['id_rpd_bup_discipline'],
        ['id_rpd_bup_discipline'],
        ondelete='CASCADE',
    )
    op.create_index(
        'ix_rpd_learning_outcomes_rpd_bup_discipline',
        'rpd_learning_outcomes',
        ['id_rpd_bup_discipline'],
    )
    op.execute("""
        UPDATE rpd_learning_outcomes lo
           SET id_rpd_bup_discipline = sub.id_rpd_bup_discipline
          FROM (
              SELECT id_rpd, MIN(id_rpd_bup_discipline) AS id_rpd_bup_discipline
                FROM rpd_bup_disciplines
               GROUP BY id_rpd
              HAVING COUNT(*) = 1
          ) sub
         WHERE lo.id_rpd = sub.id_rpd
           AND lo.id_rpd_bup_discipline IS NULL
    """)
    op.execute("""
        UPDATE rpd_learning_outcomes lo
           SET id_rpd_bup_discipline = sub.id_rpd_bup_discipline
          FROM (
              SELECT DISTINCT ON (lo2.id_outcome)
                     lo2.id_outcome,
                     rbd.id_rpd_bup_discipline
                FROM rpd_learning_outcomes lo2
                JOIN competency_indicators ci ON ci.id_indicator = lo2.id_indicator
                JOIN bup_discipline_competencies bdc ON bdc.id_competency = ci.id_competency
                JOIN rpd_bup_disciplines rbd
                  ON rbd.id_rpd = lo2.id_rpd
                 AND rbd.id_bup_discipline = bdc.id_bup_discipline
               WHERE lo2.id_rpd_bup_discipline IS NULL
                 AND lo2.id_indicator IS NOT NULL
               ORDER BY lo2.id_outcome, rbd.id_rpd_bup_discipline
          ) sub
         WHERE lo.id_outcome = sub.id_outcome
    """)


def downgrade() -> None:
    op.drop_index('ix_rpd_learning_outcomes_rpd_bup_discipline', table_name='rpd_learning_outcomes')
    op.drop_constraint('fk_rpd_learning_outcomes_rpd_bup_discipline', 'rpd_learning_outcomes', type_='foreignkey')
    op.drop_column('rpd_learning_outcomes', 'id_rpd_bup_discipline')
