from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import (
    Competency, BupDiscipline, BupDisciplineCompetency,
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

def _comp_to_out(comp: Competency) -> DisciplineCompetencyOut:
    return DisciplineCompetencyOut(
        id_competency=comp.id_competency,
        code=comp.code,
        name=comp.name,
        indicators=[
            IndicatorOut(
                id_indicator=ind.id_indicator,
                code=ind.code,
                description=ind.description,
            )
            for ind in comp.indicators
        ],
    )

@router.get("/by-discipline/{discipline_id}", response_model=list[DisciplineCompetencyOut])
async def competencies_by_discipline(
    discipline_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BupDisciplineCompetency)
        .join(BupDiscipline, BupDiscipline.id_bup_discipline == BupDisciplineCompetency.id_bup_discipline)
        .where(BupDiscipline.id_discipline == discipline_id)
        .options(
            selectinload(BupDisciplineCompetency.competency).selectinload(Competency.indicators)
        )
    )
    seen: dict[int, Competency] = {}
    for link in result.scalars().all():
        seen.setdefault(link.competency.id_competency, link.competency)
    return [_comp_to_out(c) for c in sorted(seen.values(), key=lambda c: c.code)]

@router.get("/by-bup-discipline/{bup_discipline_id}", response_model=list[DisciplineCompetencyOut])
async def competencies_by_bup_discipline(
    bup_discipline_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BupDisciplineCompetency)
        .where(BupDisciplineCompetency.id_bup_discipline == bup_discipline_id)
        .options(
            selectinload(BupDisciplineCompetency.competency).selectinload(Competency.indicators)
        )
    )
    comps = [link.competency for link in result.scalars().all()]
    return [_comp_to_out(c) for c in sorted(comps, key=lambda c: c.code)]
