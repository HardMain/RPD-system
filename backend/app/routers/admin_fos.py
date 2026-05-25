from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.crud import ensure_permission, get_or_404
from app.core.database import get_db
from app.models import RpdFosFile, StoredFile, User
from app.services import storage_service

router = APIRouter(prefix="/api/admin/fos-files", tags=["admin-fos"])

FOS_KINDS = {"fos_main", "fos_other"}
MAX_BYTES = 10 * 1024 * 1024


def _ensure_perm(user: User) -> None:
    ensure_permission(user, "sources.manage", detail="Недостаточно прав")


class AdminFosOut(BaseModel):
    id_file: int
    original_name: str
    size_bytes: int | None
    mime: str | None
    uploaded_at: str | None
    usage_count: int


class AdminFosUpdate(BaseModel):
    original_name: str | None = None


def _to_out(sf: StoredFile, usage: int) -> AdminFosOut:
    return AdminFosOut(
        id_file=sf.id_file,
        original_name=sf.original_name,
        size_bytes=sf.size_bytes,
        mime=sf.mime,
        uploaded_at=sf.uploaded_at.isoformat() if sf.uploaded_at else None,
        usage_count=usage,
    )


@router.get("/", response_model=list[AdminFosOut])
async def list_fos(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    res = await db.execute(
        select(StoredFile, func.count(RpdFosFile.id_rpd_fos))
        .where(StoredFile.kind.in_(FOS_KINDS))
        .outerjoin(RpdFosFile, RpdFosFile.id_file == StoredFile.id_file)
        .group_by(StoredFile.id_file)
        .order_by(StoredFile.uploaded_at.desc())
    )
    return [_to_out(sf, usage or 0) for sf, usage in res.all()]


@router.post("/", response_model=AdminFosOut, status_code=201)
async def upload_fos(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    fname = file.filename or "fos.pdf"
    if not fname.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Ожидается PDF")
    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Размер файла превышает 10 МБ")
    storage_uri, size = storage_service.save_bytes("fos_other", fname, content)
    sf = StoredFile(
        kind="fos_other", original_name=fname, mime=file.content_type or "application/pdf",
        size_bytes=size, storage_uri=storage_uri, id_uploaded_by=user.id_user,
    )
    db.add(sf)
    await db.commit()
    await db.refresh(sf)
    return _to_out(sf, 0)


@router.patch("/{file_id}", response_model=AdminFosOut)
async def update_fos(
    file_id: int,
    payload: AdminFosUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    sf = await get_or_404(db, StoredFile, file_id, "Файл не найден")
    if sf.kind not in FOS_KINDS:
        raise HTTPException(status_code=400, detail="Не ФОС-файл")
    if payload.original_name is not None:
        name = payload.original_name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Имя не может быть пустым")
        sf.original_name = name
    await db.commit()
    res = await db.execute(
        select(func.count(RpdFosFile.id_rpd_fos)).where(RpdFosFile.id_file == file_id)
    )
    usage = res.scalar_one() or 0
    return _to_out(sf, usage)


@router.delete("/{file_id}", status_code=204)
async def delete_fos(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    sf = await get_or_404(db, StoredFile, file_id, "Файл не найден")
    if sf.kind not in FOS_KINDS:
        raise HTTPException(status_code=400, detail="Не ФОС-файл")
    res = await db.execute(
        select(func.count(RpdFosFile.id_rpd_fos)).where(RpdFosFile.id_file == file_id)
    )
    usage = res.scalar_one() or 0
    if usage > 0:
        raise HTTPException(status_code=400, detail=f"Файл используется в {usage} РПД. Сначала открепите его.")
    try:
        storage_service.delete(sf.storage_uri)
    except Exception:
        pass
    await db.delete(sf)
    await db.commit()
