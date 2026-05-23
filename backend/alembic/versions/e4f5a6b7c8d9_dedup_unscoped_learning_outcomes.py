"""re-backfill unscoped learning outcomes and drop duplicates

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-05-23 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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
    op.execute("""
        DELETE FROM rpd_learning_outcomes
         WHERE id_outcome IN (
             SELECT id_outcome FROM (
                 SELECT id_outcome,
                        ROW_NUMBER() OVER (
                            PARTITION BY id_rpd, id_rpd_bup_discipline, id_indicator
                            ORDER BY
                                CASE WHEN outcome_text IS NOT NULL AND btrim(outcome_text) <> '' THEN 0 ELSE 1 END,
                                CASE WHEN assessment_tool IS NOT NULL AND btrim(assessment_tool) <> '' THEN 0 ELSE 1 END,
                                id_outcome DESC
                        ) AS rn
                   FROM rpd_learning_outcomes
                  WHERE id_indicator IS NOT NULL
             ) ranked
            WHERE rn > 1
         )
    """)


def downgrade() -> None:
    pass
