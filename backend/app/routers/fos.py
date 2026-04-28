"""ФОС РПД: основной файл (main) и прочие (other).

Файлы лежат в общем хранилище (`stored_files`), привязка к РПД — через
`rpd_fos_files`. Можно загрузить новый PDF (`POST /api/rpd/{id}/fos`) или
выбрать ранее загруженный (`POST /api/rpd/{id}/fos/select`).
"""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models import Rpd, RpdFosFile, StoredFile, User
from app.schemas import FosFileOut, FosFileSelect
from app.services import storage_service

router = APIRouter(prefix="/api/rpd", tags=["fos"])

ALLOWED_ROLES = {"main", "other"}
MAX_BYTES = 10 * 1024 * 1024  # 10 МБ — потолок на ФОС-файл


def _to_out(link: RpdFosFile) -> FosFileOut:
    sf = link.file
    return FosFileOut(
        id_rpd_fos=link.id_rpd_fos, id_file=link.id_file, role=link.role,
        name=link.name, comment=link.comment,
        original_name=sf.original_name if sf else "",
        size_bytes=sf.size_bytes if sf else None,
    )


async def _replace_main_if_needed(rpd_id: int, role: str, db: AsyncSession):
    """`main` может быть только один — старый удаляем."""
    if role != "main":
        return
    res = await db.execute(
        select(RpdFosFile).where(RpdFosFile.id_rpd == rpd_id)
        .where(RpdFosFile.role == "main")
    )
    for old in res.scalars().all():
        await db.delete(old)
    await db.flush()


@router.get("/{rpd_id}/fos", response_model=list[FosFileOut])
async def list_fos(
    rpd_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    res = await db.execute(
        select(RpdFosFile).where(RpdFosFile.id_rpd == rpd_id)
        .options(selectinload(RpdFosFile.file))
        .order_by(RpdFosFile.role.desc(), RpdFosFile.created_at)
    )
    return [_to_out(l) for l in res.scalars().all()]


@router.post("/{rpd_id}/fos", response_model=FosFileOut, status_code=201)
async def upload_fos(
    rpd_id: int,
    file: UploadFile = File(...),
    role: str = Form("other"),
    name: str | None = Form(None),
    comment: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"role должен быть one of {ALLOWED_ROLES}")
    rpd = await db.get(Rpd, rpd_id)
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")
    fname = file.filename or "fos.pdf"
    if not fname.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Ожидается PDF")
    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Размер файла превышает 10 МБ")

    storage_uri, size = storage_service.save_bytes(f"fos_{role}", fname, content)
    sf = StoredFile(
        kind=f"fos_{role}", original_name=fname, mime=file.content_type or "application/pdf",
        size_bytes=size, storage_uri=storage_uri, id_uploaded_by=user.id_user,
    )
    db.add(sf)
    await db.flush()

    await _replace_main_if_needed(rpd_id, role, db)

    link = RpdFosFile(
        id_rpd=rpd_id, id_file=sf.id_file, role=role,
        name=(name or fname), comment=comment,
    )
    db.add(link)
    await db.commit()
    res = await db.execute(
        select(RpdFosFile).where(RpdFosFile.id_rpd_fos == link.id_rpd_fos)
        .options(selectinload(RpdFosFile.file))
    )
    return _to_out(res.scalar_one())


@router.post("/{rpd_id}/fos/select", response_model=FosFileOut, status_code=201)
async def select_fos(
    rpd_id: int,
    data: FosFileSelect,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Прикрепить уже существующий файл из хранилища."""
    if data.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"role должен быть one of {ALLOWED_ROLES}")
    rpd = await db.get(Rpd, rpd_id)
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")
    sf = await db.get(StoredFile, data.id_file)
    if not sf:
        raise HTTPException(status_code=404, detail="Файл не найден")

    await _replace_main_if_needed(rpd_id, data.role, db)

    link = RpdFosFile(
        id_rpd=rpd_id, id_file=sf.id_file, role=data.role,
        name=(data.name or sf.original_name), comment=data.comment,
    )
    db.add(link)
    await db.commit()
    res = await db.execute(
        select(RpdFosFile).where(RpdFosFile.id_rpd_fos == link.id_rpd_fos)
        .options(selectinload(RpdFosFile.file))
    )
    return _to_out(res.scalar_one())


@router.delete("/fos/{fos_id}", status_code=204)
async def remove_fos(
    fos_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Открепить файл от РПД (сам файл из хранилища не удаляется — может
    использоваться где-то ещё)."""
    link = await db.get(RpdFosFile, fos_id)
    if not link:
        raise HTTPException(status_code=404)
    await db.delete(link)
    await db.commit()


@router.get("/fos/library", response_model=list[FosFileOut])
async def fos_library(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Все ФОС-файлы во всех РПД (упрощённая «библиотека ФОС») —
    для выбора уже загруженных файлов в новой РПД."""
    res = await db.execute(
        select(RpdFosFile).options(selectinload(RpdFosFile.file))
        .order_by(RpdFosFile.created_at.desc()).limit(200)
    )
    return [_to_out(l) for l in res.scalars().all()]
