from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models import User, DictionaryEntry

router = APIRouter(prefix="/api/suggestions", tags=["suggestions"])

ALLOWED_KINDS = {
    "software_name", "software_purpose",
    "database_name",
    "equipment", "room_type",
    "literature_title",
    "assessment_tool",
    "competency_code", "indicator_code", "indicator_description",
}
SCOPED_KINDS = {"literature_title", "indicator_code", "indicator_description"}


@router.get("/{kind}")
async def list_suggestions(
    kind: str,
    q: str | None = Query(default=None),
    source_type: str | None = Query(default=None),
    mode: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if kind not in ALLOWED_KINDS:
        raise HTTPException(status_code=404, detail="Неизвестный справочник")
    stmt = (
        select(DictionaryEntry.value, func.min(DictionaryEntry.created_at).label("first_at"))
        .where(DictionaryEntry.kind == kind)
        .where(DictionaryEntry.value.is_not(None))
        .where(func.length(func.trim(DictionaryEntry.value)) > 0)
    )
    if kind in SCOPED_KINDS and source_type:
        stmt = stmt.where(DictionaryEntry.source_type == source_type)
    if kind == "literature_title" and mode in ("printed", "electronic"):
        stmt = stmt.where(DictionaryEntry.mode == mode)
    if kind == "indicator_description":
        stmt = stmt.where(~DictionaryEntry.value.ilike("%требуется заполнение%"))
    if q:
        stmt = stmt.where(DictionaryEntry.value.ilike(f"%{q.strip()}%"))
    stmt = (
        stmt.group_by(DictionaryEntry.value)
            .order_by(func.lower(DictionaryEntry.value).asc())
            .limit(limit)
    )
    res = await db.execute(stmt)
    items = [row[0].strip() for row in res.all() if row[0]]
    return {"items": items}
