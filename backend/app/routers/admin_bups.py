from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user, user_can
from app.core.database import get_db
from app.models import (
    Bup, BupDiscipline, BupDisciplineCompetency,
    Direction, Competency, DictionaryEntry, StoredFile, User,
    RpdBupDiscipline,
)
from app.routers.bups import _bup_out, _bd_out
from app.schemas import (
    BupOut, BupDetailOut, BupDisciplineOut, BupCreate, BupUpdate,
    BupDisciplineCreate, BupDisciplineUpdate, BupImportResult,
)
from app.services import storage_service
from app.services.bup_parser import parse_bup_xls
from app.services.bup_importer import import_parsed_bup

router = APIRouter(prefix="/api/admin/bups", tags=["admin-bups"])

def _require_admin(user: User):
    if not user_can(user, "bups.manage"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

def _year_from_filename(name: str) -> int | None:
    m = re.search(r"(20\d{2}|19\d{2})", name or "")
    return int(m.group(1)) if m else None

async def _load_bup_detail(db: AsyncSession, bup_id: int) -> BupDetailOut:
    res = await db.execute(
        select(Bup).where(Bup.id_bup == bup_id)
        .options(
            selectinload(Bup.direction),
            selectinload(Bup.disciplines).selectinload(BupDiscipline.discipline),
            selectinload(Bup.disciplines).selectinload(BupDiscipline.department),
        )
    )
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="БУП не найден")
    base = _bup_out(b)
    return BupDetailOut(**base.model_dump(), disciplines=[_bd_out(bd) for bd in b.disciplines])

@router.get("/", response_model=list[BupOut])
async def admin_list_bups(
    direction_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    q = select(Bup).options(selectinload(Bup.direction))
    if direction_id:
        q = q.where(Bup.id_direction == direction_id)
    q = q.order_by(Bup.year.desc().nullslast(), Bup.name)
    res = await db.execute(q)
    return [_bup_out(b) for b in res.scalars().all()]

@router.get("/{bup_id}", response_model=BupDetailOut)
async def admin_get_bup(
    bup_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    return await _load_bup_detail(db, bup_id)

@router.post("/", response_model=BupDetailOut, status_code=201)
async def admin_create_bup(
    data: BupCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    direc = await db.get(Direction, data.id_direction)
    if not direc:
        raise HTTPException(status_code=400, detail="Направление не найдено")
    bup = Bup(
        id_direction=data.id_direction,
        name=data.name,
        year=data.year,
        faculty=data.faculty,
        profile=data.profile,
    )
    db.add(bup)
    await db.commit()
    return await _load_bup_detail(db, bup.id_bup)

@router.patch("/{bup_id}", response_model=BupDetailOut)
async def admin_update_bup(
    bup_id: int,
    data: BupUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    bup = await db.get(Bup, bup_id)
    if not bup:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(bup, k, v)
    await db.commit()
    return await _load_bup_detail(db, bup_id)

@router.delete("/{bup_id}", status_code=204)
async def admin_delete_bup(
    bup_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    bup = await db.get(
        Bup, bup_id,
        options=[selectinload(Bup.disciplines)],
    )
    if not bup:
        raise HTTPException(status_code=404)

    bd_ids = [bd.id_bup_discipline for bd in bup.disciplines]

    if bd_ids:
        rbd_res = await db.execute(
            select(RpdBupDiscipline)
            .where(RpdBupDiscipline.id_bup_discipline.in_(bd_ids))
            .options(
                selectinload(RpdBupDiscipline.bup_discipline)
                    .selectinload(BupDiscipline.discipline),
                selectinload(RpdBupDiscipline.bup_discipline)
                    .selectinload(BupDiscipline.bup)
                    .selectinload(Bup.direction)
                    .selectinload(Direction.fgos_file),
            )
        )
        from app.routers.rpd import _fill_rpd_bup_disc_snapshot
        for link in rbd_res.scalars().all():
            if link.bup_discipline is not None and not link.bup_name:
                _fill_rpd_bup_disc_snapshot(link, link.bup_discipline)
            link.id_bup_discipline = None
        await db.flush()

    src_id = bup.id_source_file
    if src_id:
        bup.id_source_file = None
        await db.flush()
    await db.delete(bup)
    await db.flush()

    if src_id:
        sf = await db.get(StoredFile, src_id)
        if sf:
            try:
                storage_service.delete(sf.storage_uri)
            except Exception:
                pass
            await db.delete(sf)
            await db.flush()

    await db.commit()

@router.post("/import-xls", response_model=BupImportResult, status_code=201)
async def admin_import_bup_xls(
    file: UploadFile = File(...),
    year: int | None = Form(None),
    name_override: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    fname = file.filename or "bup.xls"
    if not fname.lower().endswith((".xls", ".xlsx")):
        raise HTTPException(status_code=400, detail="Ожидается файл .xls/.xlsx")

    content = await file.read()
    try:
        parsed = parse_bup_xls(content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Не удалось разобрать БУП: {exc}")

    storage_uri, size = storage_service.save_bytes("bup_xls", fname, content)
    sf = StoredFile(
        kind="bup_xls",
        original_name=fname,
        mime=file.content_type,
        size_bytes=size,
        storage_uri=storage_uri,
        id_uploaded_by=user.id_user,
    )
    db.add(sf)
    await db.flush()

    if year is None:
        year = _year_from_filename(fname)

    before_dict_codes_res = await db.execute(
        select(DictionaryEntry.value).where(DictionaryEntry.kind == "competency_code")
    )
    before_dict_codes = set(before_dict_codes_res.scalars().all())

    bup = await import_parsed_bup(
        db, parsed, year=year, name_override=name_override, id_source_file=sf.id_file,
    )
    await db.commit()

    from app.services.dictionary_service import backfill_from_approved
    await backfill_from_approved(db)

    bup_codes_res = await db.execute(
        select(Competency.code).distinct()
        .join(BupDisciplineCompetency, BupDisciplineCompetency.id_competency == Competency.id_competency)
        .join(BupDiscipline, BupDiscipline.id_bup_discipline == BupDisciplineCompetency.id_bup_discipline)
        .where(BupDiscipline.id_bup == bup.id_bup)
    )
    bup_codes = set(bup_codes_res.scalars().all())
    new_codes = sorted(bup_codes - before_dict_codes)

    detail = await _load_bup_detail(db, bup.id_bup)
    warnings: list[str] = []
    if not parsed.direction_code:
        warnings.append("В файле не удалось извлечь код направления подготовки")
    if not parsed.disciplines:
        warnings.append("Не удалось распознать ни одной дисциплины")

    return BupImportResult(
        bup=detail,
        parsed_disciplines=len(parsed.disciplines),
        created_competencies=new_codes,
        warnings=warnings,
    )

async def _set_bd_competencies(
    db: AsyncSession, bd: BupDiscipline, ids: list[int]
) -> None:
    res = await db.execute(
        select(BupDisciplineCompetency)
        .where(BupDisciplineCompetency.id_bup_discipline == bd.id_bup_discipline)
    )
    for link in res.scalars().all():
        await db.delete(link)
    seen: set[int] = set()
    for cid in ids:
        if cid in seen:
            continue
        seen.add(cid)
        db.add(BupDisciplineCompetency(
            id_bup_discipline=bd.id_bup_discipline, id_competency=cid,
        ))

@router.post("/{bup_id}/disciplines", response_model=BupDisciplineOut, status_code=201)
async def admin_add_bup_discipline(
    bup_id: int,
    data: BupDisciplineCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    bup = await db.get(Bup, bup_id)
    if not bup:
        raise HTTPException(status_code=404, detail="БУП не найден")
    bd = BupDiscipline(
        id_bup=bup_id,
        **data.model_dump(exclude={"competency_ids"}),
    )
    db.add(bd)
    await db.flush()
    await _set_bd_competencies(db, bd, data.competency_ids)
    await db.commit()

    res = await db.execute(
        select(BupDiscipline).where(BupDiscipline.id_bup_discipline == bd.id_bup_discipline)
        .options(selectinload(BupDiscipline.discipline), selectinload(BupDiscipline.department))
    )
    return _bd_out(res.scalar_one())

@router.patch("/disciplines/{bd_id}", response_model=BupDisciplineOut)
async def admin_update_bup_discipline(
    bd_id: int,
    data: BupDisciplineUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    bd = await db.get(BupDiscipline, bd_id)
    if not bd:
        raise HTTPException(status_code=404)
    payload = data.model_dump(exclude_unset=True)
    comp_ids = payload.pop("competency_ids", None)
    for k, v in payload.items():
        setattr(bd, k, v)
    if comp_ids is not None:
        await _set_bd_competencies(db, bd, comp_ids)
    await db.commit()

    res = await db.execute(
        select(BupDiscipline).where(BupDiscipline.id_bup_discipline == bd_id)
        .options(selectinload(BupDiscipline.discipline), selectinload(BupDiscipline.department))
    )
    return _bd_out(res.scalar_one())

@router.delete("/disciplines/{bd_id}", status_code=204)
async def admin_delete_bup_discipline(
    bd_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    bd = await db.get(BupDiscipline, bd_id)
    if not bd:
        raise HTTPException(status_code=404)
    await db.delete(bd)
    await db.commit()

@router.get("/{bup_id}/source-file")
async def admin_download_bup_source(
    bup_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    bup = await db.get(Bup, bup_id)
    if not bup or not bup.id_source_file:
        raise HTTPException(status_code=404, detail="Исходный файл не прикреплён")
    sf = await db.get(StoredFile, bup.id_source_file)
    if not sf:
        raise HTTPException(status_code=404)
    try:
        return storage_service.file_response(
            sf.storage_uri, filename=sf.original_name,
            mime=sf.mime or "application/octet-stream",
        )
    except (FileNotFoundError, ValueError):
        raise HTTPException(status_code=404, detail="Файл отсутствует в хранилище")
