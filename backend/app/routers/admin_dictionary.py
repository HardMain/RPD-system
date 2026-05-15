from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, user_can
from app.core.database import get_db
from app.models import User, DictionaryEntry

router = APIRouter(prefix="/api/admin/dictionary", tags=["admin-dictionary"])

ALLOWED_KINDS = {
    "software_name", "software_purpose",
    "database_name",
    "equipment", "room_type",
    "literature_title",
    "assessment_tool",
    "competency_code", "indicator_code", "indicator_description",
    "faculty", "employee_title",
}
SCOPED_KINDS = {"literature_title", "indicator_code", "indicator_description"}

LITERATURE_MODES = {"printed", "electronic"}


class DictionaryEntryOut(BaseModel):
    id_entry: int
    kind: str
    value: str
    source_type: str | None = None
    mode: str | None = None
    source: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class DictionaryEntryCreate(BaseModel):
    value: str
    source_type: str | None = None
    mode: str | None = None


class DictionaryEntryUpdate(BaseModel):
    value: str | None = None
    source_type: str | None = None
    mode: str | None = None


def _ensure_perm(user: User) -> None:
    if not user_can(user, "sources.manage"):
        raise HTTPException(status_code=403, detail="Недостаточно прав для управления справочниками")


@router.get("/{kind}", response_model=list[DictionaryEntryOut])
async def list_entries(
    kind: str,
    q: str | None = Query(default=None),
    source_type: str | None = Query(default=None),
    mode: str | None = Query(default=None),
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
    if kind == "literature_title":
        if mode and mode not in LITERATURE_MODES:
            raise HTTPException(status_code=400, detail="mode должен быть printed/electronic")
    elif kind in SCOPED_KINDS:
        mode = None
    else:
        source_type = None
        mode = None

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
    existing = (await db.execute(dup_stmt)).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Такая запись уже есть")

    entry = DictionaryEntry(
        kind=kind, value=value,
        source_type=source_type, mode=mode,
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
