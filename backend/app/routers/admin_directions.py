from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user, user_can
from app.core.crud import get_or_404, ensure_permission
from app.core.database import get_db
from app.models import Bup, Competency, Direction, DirectionProgram, StoredFile, User
from app.services import storage_service

router = APIRouter(prefix="/api/admin/directions", tags=["admin-directions"])

class ProgramOut(BaseModel):
    id_program: int
    profile: str

class DirectionAdminOut(BaseModel):
    id_direction: int
    code: str
    name: str
    degree_level: str | None = None
    fgos_file_id: int | None = None
    fgos_file_name: str | None = None
    programs: list[ProgramOut] = []

class DirectionUpdate(BaseModel):
    code: str | None = None
    name: str | None = None

class DirectionCreate(BaseModel):
    code: str
    name: str

class ProgramPayload(BaseModel):
    profile: str

def _require_admin(user: User):
    ensure_permission(user, "sources.manage")

async def _load(db: AsyncSession, direction_id: int) -> Direction:
    res = await db.execute(
        select(Direction).where(Direction.id_direction == direction_id)
        .options(selectinload(Direction.fgos_file), selectinload(Direction.programs))
    )
    direc = res.scalar_one_or_none()
    if direc is None:
        raise HTTPException(status_code=404, detail="Направление не найдено")
    return direc

def _to_out(d: Direction) -> DirectionAdminOut:
    fgos = d.fgos_file
    return DirectionAdminOut(
        id_direction=d.id_direction,
        code=d.code, name=d.name, degree_level=d.degree_level,
        fgos_file_id=fgos.id_file if fgos else None,
        fgos_file_name=fgos.original_name if fgos else None,
        programs=[ProgramOut(id_program=p.id_program, profile=p.profile) for p in (d.programs or [])],
    )

@router.get("/", response_model=list[DirectionAdminOut])
async def admin_list_directions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    res = await db.execute(
        select(Direction)
        .options(selectinload(Direction.fgos_file), selectinload(Direction.programs))
        .order_by(Direction.code)
    )
    return [_to_out(d) for d in res.scalars().all()]

@router.post("/", response_model=DirectionAdminOut, status_code=201)
async def admin_create_direction(
    data: DirectionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    code = (data.code or "").strip()
    name = (data.name or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Код обязателен")
    if not name:
        raise HTTPException(status_code=400, detail="Название обязательно")
    exists = await db.execute(select(Direction).where(Direction.code == code))
    if exists.scalars().first():
        raise HTTPException(status_code=400, detail="Направление с таким кодом уже есть")
    direc = Direction(code=code, name=name)
    db.add(direc)
    await db.commit()
    return _to_out(await _load(db, direc.id_direction))

@router.patch("/{direction_id}", response_model=DirectionAdminOut)
async def admin_update_direction(
    direction_id: int,
    data: DirectionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    direc = await get_or_404(db, Direction, direction_id, "Направление не найдено")
    if data.code is not None:
        code = data.code.strip()
        if not code:
            raise HTTPException(status_code=400, detail="Код обязателен")
        direc.code = code
    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Название обязательно")
        direc.name = name
    await db.commit()
    return _to_out(await _load(db, direction_id))

@router.post("/{direction_id}/programs", response_model=DirectionAdminOut, status_code=201)
async def admin_add_program(
    direction_id: int,
    data: ProgramPayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    direc = await _load(db, direction_id)
    profile = (data.profile or "").strip()
    if not profile:
        raise HTTPException(status_code=400, detail="Профиль обязателен")
    if any(p.profile.strip().lower() == profile.lower() for p in direc.programs):
        raise HTTPException(status_code=400, detail="Такой профиль уже есть у направления")
    db.add(DirectionProgram(id_direction=direction_id, profile=profile))
    await db.commit()
    return _to_out(await _load(db, direction_id))

@router.patch("/programs/{program_id}", response_model=DirectionAdminOut)
async def admin_update_program(
    program_id: int,
    data: ProgramPayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    prog = await get_or_404(db, DirectionProgram, program_id, "Профиль не найден")
    profile = (data.profile or "").strip()
    if not profile:
        raise HTTPException(status_code=400, detail="Профиль обязателен")
    direction_id = prog.id_direction
    prog.profile = profile
    await db.commit()
    return _to_out(await _load(db, direction_id))

@router.delete("/programs/{program_id}", response_model=DirectionAdminOut)
async def admin_delete_program(
    program_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    prog = await get_or_404(db, DirectionProgram, program_id, "Профиль не найден")
    direction_id = prog.id_direction
    await db.delete(prog)
    await db.commit()
    return _to_out(await _load(db, direction_id))

@router.post("/{direction_id}/fgos", response_model=DirectionAdminOut, status_code=201)
async def admin_upload_fgos(
    direction_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    direc = await get_or_404(db, Direction, direction_id, "Направление не найдено")
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
    return _to_out(await _load(db, direction_id))

@router.delete("/{direction_id}/fgos", status_code=204)
async def admin_remove_fgos(
    direction_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    direc = await get_or_404(db, Direction, direction_id)
    if not direc.id_fgos_file:
        return
    old = await db.get(StoredFile, direc.id_fgos_file)
    direc.id_fgos_file = None
    if old:
        storage_service.delete(old.storage_uri)
        await db.delete(old)
    await db.commit()

@router.delete("/{direction_id}", status_code=204)
async def admin_delete_direction(
    direction_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    direc = await get_or_404(db, Direction, direction_id, "Направление не найдено")
    bup_count = await db.scalar(
        select(func.count(Bup.id_bup)).where(Bup.id_direction == direction_id)
    )
    comp_count = await db.scalar(
        select(func.count(Competency.id_competency)).where(Competency.id_direction == direction_id)
    )
    blockers = []
    if bup_count:
        blockers.append(f"БУПов: {bup_count}")
    if comp_count:
        blockers.append(f"компетенций: {comp_count}")
    if blockers:
        raise HTTPException(
            status_code=400,
            detail="Нельзя удалить направление — на него ссылаются " + ", ".join(blockers)
            + ". Сначала удалите связанные записи.",
        )
    if direc.id_fgos_file:
        old = await db.get(StoredFile, direc.id_fgos_file)
        if old:
            storage_service.delete(old.storage_uri)
            await db.delete(old)
    await db.delete(direc)
    await db.commit()
