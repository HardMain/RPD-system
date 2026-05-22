from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, user_can
from app.core.crud import get_or_404, ensure_permission
from app.core.database import get_db
from app.models import User, DictionaryEntry

router = APIRouter(prefix="/api/admin/dictionary", tags=["admin-dictionary"])

ALLOWED_KINDS = {
    "software_name",
    "database_name",
    "equipment", "room_type",
    "literature_title",
    "assessment_tool",
    "competency_code", "indicator_code", "indicator_description",
    "faculty", "employee_title",
}
SCOPED_KINDS = {"literature_title", "indicator_code", "indicator_description", "software_name"}
DIRECTION_SCOPED_KINDS = {"indicator_description"}
DISCIPLINE_SCOPED_KINDS = {"literature_title"}
SOFTWARE_TYPES = [
    "Операционные системы",
    "Офисные приложения",
    "Среды разработки, тестирования и отладки",
    "ПО для обработки изображений",
    "Системы управления проектами",
    "Прикладное программное обеспечение общего назначения",
]

LITERATURE_MODES = {"printed", "electronic"}


class DictionaryEntryOut(BaseModel):
    id_entry: int
    kind: str
    value: str
    source_type: str | None = None
    mode: str | None = None
    direction_code: str | None = None
    id_discipline: int | None = None
    extra: str | None = None
    source: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class DictionaryEntryCreate(BaseModel):
    value: str
    source_type: str | None = None
    mode: str | None = None
    direction_code: str | None = None
    id_discipline: int | None = None
    extra: str | None = None


class DictionaryEntryUpdate(BaseModel):
    value: str | None = None
    source_type: str | None = None
    mode: str | None = None
    direction_code: str | None = None
    id_discipline: int | None = None
    extra: str | None = None


def _ensure_perm(user: User) -> None:
    ensure_permission(user, "sources.manage", detail="Недостаточно прав для управления справочниками")


@router.get("/{kind}", response_model=list[DictionaryEntryOut])
async def list_entries(
    kind: str,
    q: str | None = Query(default=None),
    source_type: str | None = Query(default=None),
    mode: str | None = Query(default=None),
    direction_code: str | None = Query(default=None),
    id_discipline: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    if kind not in ALLOWED_KINDS:
        raise HTTPException(status_code=404, detail="Неизвестный справочник")
    stmt = select(DictionaryEntry).where(DictionaryEntry.kind == kind)
    if kind in SCOPED_KINDS and source_type:
        stmt = stmt.where(DictionaryEntry.source_type == source_type)
    if kind == "literature_title" and mode in LITERATURE_MODES:
        stmt = stmt.where(DictionaryEntry.mode == mode)
    if kind in DIRECTION_SCOPED_KINDS and direction_code:
        stmt = stmt.where(DictionaryEntry.direction_code == direction_code.strip())
    if kind in DISCIPLINE_SCOPED_KINDS and id_discipline:
        stmt = stmt.where(DictionaryEntry.id_discipline == id_discipline)
    if q:
        stmt = stmt.where(DictionaryEntry.value.ilike(f"%{q.strip()}%"))
    stmt = stmt.order_by(func.lower(DictionaryEntry.value).asc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/{kind}", response_model=DictionaryEntryOut, status_code=201)
async def create_entry(
    kind: str,
    data: DictionaryEntryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    if kind not in ALLOWED_KINDS:
        raise HTTPException(status_code=404, detail="Неизвестный справочник")
    value = (data.value or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Пустое значение")

    source_type = (data.source_type or "").strip() or None
    mode = (data.mode or "").strip() or None
    direction_code = (data.direction_code or "").strip() or None
    if kind == "literature_title":
        if mode and mode not in LITERATURE_MODES:
            raise HTTPException(status_code=400, detail="mode должен быть printed/electronic")
    elif kind in SCOPED_KINDS:
        mode = None
    else:
        source_type = None
        mode = None
    if kind == "software_name":
        if not source_type:
            raise HTTPException(status_code=400, detail="Не выбран вид ПО")
        if source_type not in SOFTWARE_TYPES:
            raise HTTPException(status_code=400, detail="Неизвестный вид ПО")
    if kind not in DIRECTION_SCOPED_KINDS:
        direction_code = None
    elif not direction_code:
        raise HTTPException(status_code=400, detail="Не выбрано направление")
    discipline_id = data.id_discipline if kind in DISCIPLINE_SCOPED_KINDS else None
    if kind in DISCIPLINE_SCOPED_KINDS and not discipline_id:
        raise HTTPException(status_code=400, detail="Не выбрана дисциплина")

    dup_stmt = select(DictionaryEntry).where(
        DictionaryEntry.kind == kind,
        func.lower(DictionaryEntry.value) == value.lower(),
    )
    if kind in SCOPED_KINDS:
        if source_type is None:
            dup_stmt = dup_stmt.where(DictionaryEntry.source_type.is_(None))
        else:
            dup_stmt = dup_stmt.where(DictionaryEntry.source_type == source_type)
    if kind == "literature_title":
        if mode is None:
            dup_stmt = dup_stmt.where(DictionaryEntry.mode.is_(None))
        else:
            dup_stmt = dup_stmt.where(DictionaryEntry.mode == mode)
    if kind in DIRECTION_SCOPED_KINDS:
        dup_stmt = dup_stmt.where(DictionaryEntry.direction_code == direction_code)
    if kind in DISCIPLINE_SCOPED_KINDS:
        dup_stmt = dup_stmt.where(DictionaryEntry.id_discipline == discipline_id)
    existing = (await db.execute(dup_stmt)).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Такая запись уже есть")

    extra = (data.extra or "").strip() or None if kind == "database_name" else None
    if kind == "database_name" and not extra:
        raise HTTPException(status_code=400, detail="Укажите ссылку на информационный ресурс")
    entry = DictionaryEntry(
        kind=kind, value=value,
        source_type=source_type, mode=mode, direction_code=direction_code,
        id_discipline=discipline_id, extra=extra,
        source="manual", created_by=user.id_user,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.patch("/{id_entry}", response_model=DictionaryEntryOut)
async def update_entry(
    id_entry: int,
    data: DictionaryEntryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    entry = (await db.execute(
        select(DictionaryEntry).where(DictionaryEntry.id_entry == id_entry)
    )).scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404)

    if data.value is not None:
        new_value = data.value.strip()
        if not new_value:
            raise HTTPException(status_code=400, detail="Пустое значение")
        entry.value = new_value
    if data.source_type is not None:
        if entry.kind == "literature_title" or entry.kind in SCOPED_KINDS:
            entry.source_type = data.source_type.strip() or None
    if data.mode is not None and entry.kind == "literature_title":
        m = data.mode.strip() or None
        if m and m not in LITERATURE_MODES:
            raise HTTPException(status_code=400, detail="mode должен быть printed/electronic")
        entry.mode = m
    if data.direction_code is not None and entry.kind in DIRECTION_SCOPED_KINDS:
        dc = data.direction_code.strip() or None
        if not dc:
            raise HTTPException(status_code=400, detail="Не выбрано направление")
        entry.direction_code = dc
    if data.id_discipline is not None and entry.kind in DISCIPLINE_SCOPED_KINDS:
        if not data.id_discipline:
            raise HTTPException(status_code=400, detail="Не выбрана дисциплина")
        entry.id_discipline = data.id_discipline
    if data.extra is not None and entry.kind == "database_name":
        entry.extra = data.extra.strip() or None

    dup_stmt = select(DictionaryEntry).where(
        DictionaryEntry.kind == entry.kind,
        DictionaryEntry.id_entry != entry.id_entry,
        func.lower(DictionaryEntry.value) == entry.value.lower(),
    )
    if entry.kind in SCOPED_KINDS:
        if entry.source_type is None:
            dup_stmt = dup_stmt.where(DictionaryEntry.source_type.is_(None))
        else:
            dup_stmt = dup_stmt.where(DictionaryEntry.source_type == entry.source_type)
    if entry.kind == "literature_title":
        if entry.mode is None:
            dup_stmt = dup_stmt.where(DictionaryEntry.mode.is_(None))
        else:
            dup_stmt = dup_stmt.where(DictionaryEntry.mode == entry.mode)
    if entry.kind in DIRECTION_SCOPED_KINDS:
        dup_stmt = dup_stmt.where(DictionaryEntry.direction_code == entry.direction_code)
    if entry.kind in DISCIPLINE_SCOPED_KINDS:
        dup_stmt = dup_stmt.where(DictionaryEntry.id_discipline == entry.id_discipline)
    dup = (await db.execute(dup_stmt)).scalars().first()
    if dup:
        raise HTTPException(status_code=400, detail="Такая запись уже есть")

    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/{id_entry}", status_code=204)
async def delete_entry(
    id_entry: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    entry = (await db.execute(
        select(DictionaryEntry).where(DictionaryEntry.id_entry == id_entry)
    )).scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404)
    await db.delete(entry)
    await db.commit()
    return
