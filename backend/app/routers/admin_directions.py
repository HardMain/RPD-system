from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models import Direction, StoredFile, User
from app.services import storage_service

router = APIRouter(prefix="/api/admin/directions", tags=["admin-directions"])

class DirectionAdminOut(BaseModel):
    id_direction: int
    code: str
    name: str
    profile: str | None = None
    degree_level: str | None = None
    fgos_file_id: int | None = None
    fgos_file_name: str | None = None

def _require_admin(user: User):
    if not user.role or user.role.name != "Администратор":
        raise HTTPException(status_code=403, detail="Доступ только для администратора")

def _to_out(d: Direction) -> DirectionAdminOut:
    fgos = d.fgos_file
    return DirectionAdminOut(
        id_direction=d.id_direction,
        code=d.code, name=d.name, profile=d.profile, degree_level=d.degree_level,
        fgos_file_id=fgos.id_file if fgos else None,
        fgos_file_name=fgos.original_name if fgos else None,
    )

@router.get("/", response_model=list[DirectionAdminOut])
async def admin_list_directions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    from sqlalchemy.orm import selectinload
    res = await db.execute(
        select(Direction).options(selectinload(Direction.fgos_file)).order_by(Direction.code)
    )
    return [_to_out(d) for d in res.scalars().all()]

@router.post("/{direction_id}/fgos", response_model=DirectionAdminOut, status_code=201)
async def admin_upload_fgos(
    direction_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    direc = await db.get(Direction, direction_id)
    if not direc:
        raise HTTPException(status_code=404, detail="Направление не найдено")
    fname = file.filename or "fgos.pdf"
    if not fname.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Ожидается PDF")
    content = await file.read()

    if direc.id_fgos_file:
        old = await db.get(StoredFile, direc.id_fgos_file)
        if old:
            storage_service.delete(old.storage_uri)
            await db.delete(old)
            await db.flush()

    storage_uri, size = storage_service.save_bytes("fgos", fname, content)
    sf = StoredFile(
        kind="fgos", original_name=fname, mime=file.content_type or "application/pdf",
        size_bytes=size, storage_uri=storage_uri, id_uploaded_by=user.id_user,
    )
    db.add(sf)
    await db.flush()
    direc.id_fgos_file = sf.id_file
    await db.commit()

    from sqlalchemy.orm import selectinload
    res = await db.execute(
        select(Direction).where(Direction.id_direction == direction_id)
        .options(selectinload(Direction.fgos_file))
    )
    return _to_out(res.scalar_one())

@router.delete("/{direction_id}/fgos", status_code=204)
async def admin_remove_fgos(
    direction_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    direc = await db.get(Direction, direction_id)
    if not direc:
        raise HTTPException(status_code=404)
    if not direc.id_fgos_file:
        return
    old = await db.get(StoredFile, direc.id_fgos_file)
    direc.id_fgos_file = None
    if old:
        storage_service.delete(old.storage_uri)
        await db.delete(old)
    await db.commit()
