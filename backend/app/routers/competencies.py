"""Competencies and indicators endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import (
    User, Competency, CompetencyIndicator, DisciplineCompetency, Discipline,
)
from app.schemas import CompetencyOut, IndicatorOut, DisciplineCompetencyOut

router = APIRouter(prefix="/api/competencies", tags=["competencies"])


@router.get("/", response_model=list[CompetencyOut])
async def list_competencies(
    direction_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Competency).options(selectinload(Competency.indicators))
    if direction_id:
        q = q.where(Competency.id_direction == direction_id)
    q = q.order_by(Competency.code)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/by-discipline/{discipline_id}", response_model=list[DisciplineCompetencyOut])
async def competencies_by_discipline(
    discipline_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get competencies linked to a specific discipline, with their indicators."""
    result = await db.execute(
        select(DisciplineCompetency)
        .where(DisciplineCompetency.id_discipline == discipline_id)
        .options(
            selectinload(DisciplineCompetency.competency)
            .selectinload(Competency.indicators)
        )
    )
    rows = result.scalars().all()
    return [
        DisciplineCompetencyOut(
            id_competency=dc.competency.id_competency,
            code=dc.competency.code,
            name=dc.competency.name,
            indicators=[
                IndicatorOut(
                    id_indicator=ind.id_indicator,
                    code=ind.code,
                    description=ind.description,
                )
                for ind in dc.competency.indicators
            ],
        )
        for dc in rows
    ]
