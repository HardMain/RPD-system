from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, user_can
from app.core.database import get_db
from app.models import User, Discipline, BupDiscipline, Rpd

router = APIRouter(prefix="/api/admin/disciplines", tags=["admin-disciplines"])


def _ensure_perm(user: User) -> None:
    if not user_can(user, "reference.manage"):
        raise HTTPException(status_code=403, detail="Недостаточно прав для управления справочниками")


class DisciplineRefOut(BaseModel):
    id_discipline: int
    name: str
    used_in_bups: int
    used_in_rpds: int


class DisciplineCreate(BaseModel):
    name: str


class DisciplineUpdate(BaseModel):
    name: str | None = None


@router.get("/", response_model=list[DisciplineRefOut])
async def list_disciplines(
    q: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    stmt = select(Discipline).order_by(func.lower(Discipline.name).asc())
    if q:
        stmt = stmt.where(Discipline.name.ilike(f"%{q.strip()}%"))
    res = await db.execute(stmt)
    rows = res.scalars().all()
    if not rows:
        return []
    ids = [d.id_discipline for d in rows]
    bd_counts = dict((await db.execute(
        select(BupDiscipline.id_discipline, func.count(BupDiscipline.id_bup_discipline))
        .where(BupDiscipline.id_discipline.in_(ids))
        .group_by(BupDiscipline.id_discipline)
    )).all())
    rpd_counts = dict((await db.execute(
        select(Rpd.id_discipline, func.count(Rpd.id_rpd))
        .where(Rpd.id_discipline.in_(ids))
        .group_by(Rpd.id_discipline)
    )).all())
    return [
        DisciplineRefOut(
            id_discipline=d.id_discipline,
            name=d.name,
            used_in_bups=int(bd_counts.get(d.id_discipline, 0)),
            used_in_rpds=int(rpd_counts.get(d.id_discipline, 0)),
        )
        for d in rows
    ]


@router.post("/", response_model=DisciplineRefOut, status_code=201)
async def create_discipline(
    data: DisciplineCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Пустое название")
    dup = (await db.execute(
        select(Discipline).where(func.lower(Discipline.name) == name.lower())
    )).scalars().first()
    if dup:
        raise HTTPException(status_code=400, detail="Такая дисциплина уже есть")
    d = Discipline(name=name)
    db.add(d)
    await db.commit()
    await db.refresh(d)
    return DisciplineRefOut(id_discipline=d.id_discipline, name=d.name, used_in_bups=0, used_in_rpds=0)


@router.patch("/{id_discipline}", response_model=DisciplineRefOut)
async def update_discipline(
    id_discipline: int,
    data: DisciplineUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    d = await db.get(Discipline, id_discipline)
    if d is None:
        raise HTTPException(status_code=404)
    if data.name is not None:
        new_name = data.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Пустое название")
        dup = (await db.execute(
            select(Discipline)
            .where(func.lower(Discipline.name) == new_name.lower())
            .where(Discipline.id_discipline != id_discipline)
        )).scalars().first()
        if dup:
            raise HTTPException(status_code=400, detail="Такая дисциплина уже есть")
        d.name = new_name
    await db.commit()
    await db.refresh(d)
    bd_count = (await db.execute(
        select(func.count(BupDiscipline.id_bup_discipline))
        .where(BupDiscipline.id_discipline == id_discipline)
    )).scalar_one()
    rpd_count = (await db.execute(
        select(func.count(Rpd.id_rpd))
        .where(Rpd.id_discipline == id_discipline)
    )).scalar_one()
    return DisciplineRefOut(
        id_discipline=d.id_discipline, name=d.name,
        used_in_bups=int(bd_count or 0), used_in_rpds=int(rpd_count or 0),
    )


@router.delete("/{id_discipline}", status_code=204)
async def delete_discipline(
    id_discipline: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    d = await db.get(Discipline, id_discipline)
    if d is None:
        raise HTTPException(status_code=404)
    bd_count = (await db.execute(
        select(func.count(BupDiscipline.id_bup_discipline))
        .where(BupDiscipline.id_discipline == id_discipline)
    )).scalar_one()
    if bd_count:
        raise HTTPException(status_code=400, detail="Дисциплина используется в БУПах — удалить нельзя")
    rpd_count = (await db.execute(
        select(func.count(Rpd.id_rpd))
        .where(Rpd.id_discipline == id_discipline)
    )).scalar_one()
    if rpd_count:
        raise HTTPException(status_code=400, detail="Дисциплина используется в РПД — удалить нельзя")
    await db.delete(d)
    await db.commit()
    return
