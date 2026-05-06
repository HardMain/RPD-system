from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Bup, BupDiscipline
from app.schemas import BupOut, BupDetailOut, BupDisciplineOut

router = APIRouter(prefix="/api/bups", tags=["bups"])

def _bup_out(b: Bup) -> BupOut:
    return BupOut(
        id_bup=b.id_bup,
        id_direction=b.id_direction,
        name=b.name,
        year=b.year,
        faculty=b.faculty,
        profile=b.profile,
        direction_code=b.direction.code if b.direction else None,
        direction_name=b.direction.name if b.direction else None,
    )

def _bd_out(bd: BupDiscipline) -> BupDisciplineOut:
    return BupDisciplineOut(
        id_bup_discipline=bd.id_bup_discipline,
        id_bup=bd.id_bup,
        id_discipline=bd.id_discipline,
        discipline_name=bd.discipline.name if bd.discipline else "",
        code=bd.code,
        semester=bd.semester,
        control_form=bd.control_form,
        total_hours=bd.total_hours,
        exam_hours=bd.exam_hours,
        lecture_hours=bd.lecture_hours,
        lab_hours=bd.lab_hours,
        practice_hours=bd.practice_hours,
        ksr_hours=bd.ksr_hours,
        self_study_hours=bd.self_study_hours,
        zet=bd.zet,
        department_name=bd.department.name if bd.department else None,
    )

@router.get("/", response_model=list[BupOut])
async def list_bups(
    direction_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Bup).options(selectinload(Bup.direction))
    if direction_id:
        q = q.where(Bup.id_direction == direction_id)
    q = q.order_by(Bup.year.desc(), Bup.name)
    result = await db.execute(q)
    return [_bup_out(b) for b in result.scalars().all()]

@router.get("/disciplines", response_model=list[BupDisciplineOut])
async def list_bup_disciplines_global(
    id_discipline: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(BupDiscipline)
        .options(
            selectinload(BupDiscipline.discipline),
            selectinload(BupDiscipline.department),
            selectinload(BupDiscipline.bup).selectinload(Bup.direction),
        )
    )
    if id_discipline is not None:
        q = q.where(BupDiscipline.id_discipline == id_discipline)
    q = q.order_by(BupDiscipline.id_bup, BupDiscipline.code)
    result = await db.execute(q)
    out: list[BupDisciplineOut] = []
    for bd in result.scalars().all():
        item = _bd_out(bd)
        if bd.bup:
            item.bup_name = bd.bup.name
            item.bup_year = bd.bup.year
            item.bup_profile = bd.bup.profile
            item.bup_form_of_study = bd.bup.form_of_study
            if bd.bup.direction:
                item.direction_code = bd.bup.direction.code
                item.direction_name = bd.bup.direction.name
        out.append(item)
    return out

@router.get("/{bup_id}", response_model=BupDetailOut)
async def get_bup(bup_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Bup).where(Bup.id_bup == bup_id)
        .options(
            selectinload(Bup.direction),
            selectinload(Bup.disciplines).selectinload(BupDiscipline.discipline),
            selectinload(Bup.disciplines).selectinload(BupDiscipline.department),
        )
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="БУП не найден")
    base = _bup_out(b)
    return BupDetailOut(**base.model_dump(), disciplines=[_bd_out(bd) for bd in b.disciplines])

@router.get("/{bup_id}/disciplines", response_model=list[BupDisciplineOut])
async def list_bup_disciplines(bup_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BupDiscipline).where(BupDiscipline.id_bup == bup_id)
        .options(
            selectinload(BupDiscipline.discipline),
            selectinload(BupDiscipline.department),
        )
        .order_by(BupDiscipline.code)
    )
    return [_bd_out(bd) for bd in result.scalars().all()]

@router.get("/disciplines/{bup_discipline_id}", response_model=BupDisciplineOut)
async def get_bup_discipline(bup_discipline_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BupDiscipline).where(BupDiscipline.id_bup_discipline == bup_discipline_id)
        .options(
            selectinload(BupDiscipline.discipline),
            selectinload(BupDiscipline.department),
        )
    )
    bd = result.scalar_one_or_none()
    if not bd:
        raise HTTPException(status_code=404, detail="Дисциплина БУП не найдена")
    return _bd_out(bd)
