from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Rpd, RpdSoftware, RpdDatabase, RpdMaterialTech, RpdLiterature,
    RpdLearningOutcome, AssessmentTool, DictionaryEntry,
    Competency, CompetencyIndicator, Direction,
    RpdBupDiscipline, BupDiscipline, Bup,
)

APPROVED_STATUS = "Согласовано"

PLACEHOLDER_VERBS = {1: "Знает", 2: "Умеет", 3: "Владеет"}


def _norm(value: str | None) -> str:
    return (value or "").strip()


def _is_placeholder(value: str | None) -> bool:
    return "требуется заполнение" in (value or "").lower()


def _indicator_index(indicator_code: str | None) -> int | None:
    import re
    m = re.match(r"^ИД-(\d+)", _norm(indicator_code))
    return int(m.group(1)) if m else None


def _placeholder_for(indicator_code: str | None) -> str:
    idx = _indicator_index(indicator_code)
    verb = PLACEHOLDER_VERBS.get(idx) if idx else None
    return f"{verb}… (требуется заполнение)" if verb else "(требуется заполнение)"


async def _existing_keys(db: AsyncSession) -> set[tuple]:
    res = await db.execute(select(
        DictionaryEntry.kind,
        DictionaryEntry.value,
        DictionaryEntry.source_type,
        DictionaryEntry.mode,
        DictionaryEntry.direction_code,
        DictionaryEntry.id_discipline,
    ))
    keys = set()
    for kind, value, st, md, dc, di in res.all():
        keys.add((
            kind, value.strip().lower(),
            (st or "").strip().lower(),
            (md or "").strip().lower(),
            (dc or "").strip().lower(),
            di or 0,
        ))
    return keys


def _add_if_new(
    db: AsyncSession,
    keys: set[tuple],
    *,
    kind: str,
    value: str,
    source: str,
    source_type: str | None = None,
    mode: str | None = None,
    direction_code: str | None = None,
    id_discipline: int | None = None,
    extra: str | None = None,
) -> bool:
    v = _norm(value)
    if not v:
        return False
    if _is_placeholder(v):
        return False
    st = _norm(source_type) or None
    md = _norm(mode) or None
    dc = _norm(direction_code) or None
    di = id_discipline or None
    key = (kind, v.lower(), (st or "").lower(), (md or "").lower(), (dc or "").lower(), di or 0)
    if key in keys:
        return False
    keys.add(key)
    db.add(DictionaryEntry(
        kind=kind, value=v, source_type=st, mode=md,
        direction_code=dc, id_discipline=di, extra=_norm(extra) or None, source=source,
    ))
    return True


async def _upsert_indicator_description(
    db: AsyncSession,
    *,
    value: str,
    source_type: str | None,
    direction_code: str | None,
    source: str,
) -> bool:
    v = _norm(value)
    st = _norm(source_type) or None
    dc = _norm(direction_code) or None
    if not v or st is None:
        return False
    is_ph = _is_placeholder(v)
    stmt = (
        select(DictionaryEntry)
        .where(DictionaryEntry.kind == "indicator_description")
        .where(DictionaryEntry.source_type == st)
    )
    if dc is None:
        stmt = stmt.where(DictionaryEntry.direction_code.is_(None))
    else:
        stmt = stmt.where(DictionaryEntry.direction_code == dc)
    res = await db.execute(stmt)
    existing = list(res.scalars().all())
    real = [e for e in existing if not _is_placeholder(e.value)]
    placeholders = [e for e in existing if _is_placeholder(e.value)]

    for e in placeholders[1:]:
        await db.delete(e)
    if real:
        for e in placeholders:
            await db.delete(e)

    if is_ph:
        if real or placeholders:
            return False
        db.add(DictionaryEntry(
            kind="indicator_description", value=v, source_type=st, direction_code=dc, source=source,
        ))
        return True

    matching = next((e for e in real if _norm(e.value).lower() == v.lower()), None)
    if matching is not None:
        return False
    if real:
        return False
    db.add(DictionaryEntry(
        kind="indicator_description", value=v, source_type=st, direction_code=dc, source=source,
    ))
    return True


async def _sync_indicator_description(
    db: AsyncSession,
    indicator: CompetencyIndicator | None,
    snapshot: str,
    direction_code: str | None = None,
) -> bool:
    if indicator is None:
        return False
    snap = _norm(snapshot)
    if not snap or _is_placeholder(snap):
        return False
    if _norm(indicator.description) == snap:
        return False
    indicator.description = snap
    dc = _norm(direction_code) or None
    stmt = (
        delete(DictionaryEntry).where(
            DictionaryEntry.kind == "indicator_description",
            DictionaryEntry.source_type == indicator.code,
            func.lower(DictionaryEntry.value).like("%требуется заполнение%"),
        )
    )
    if dc is None:
        stmt = stmt.where(DictionaryEntry.direction_code.is_(None))
    else:
        stmt = stmt.where(DictionaryEntry.direction_code == dc)
    await db.execute(stmt)
    return True


async def harvest_rpd(db: AsyncSession, rpd_id: int, *, keys: set[tuple] | None = None) -> int:
    if keys is None:
        keys = await _existing_keys(db)
    res = await db.execute(
        select(Rpd).where(Rpd.id_rpd == rpd_id).options(
            selectinload(Rpd.software),
            selectinload(Rpd.databases),
            selectinload(Rpd.material_tech),
            selectinload(Rpd.literature),
            selectinload(Rpd.learning_outcomes).selectinload(RpdLearningOutcome.indicator),
            selectinload(Rpd.bup_links)
                .selectinload(RpdBupDiscipline.bup_discipline)
                .selectinload(BupDiscipline.bup)
                .selectinload(Bup.direction),
        )
    )
    rpd = res.scalar_one_or_none()
    if rpd is None:
        return 0

    def _link_direction(bl) -> str:
        snap = _norm(bl.direction_code)
        if snap:
            return snap
        bd = getattr(bl, "bup_discipline", None)
        bup = getattr(bd, "bup", None) if bd is not None else None
        direc = getattr(bup, "direction", None) if bup is not None else None
        return _norm(getattr(direc, "code", "")) if direc is not None else ""

    direction_code = next(
        (_link_direction(bl) for bl in (rpd.bup_links or []) if _link_direction(bl)),
        None,
    )
    discipline_id = rpd.id_discipline or None
    added = 0
    for s in rpd.software or []:
        if _add_if_new(db, keys, kind="software_name", value=s.name, source="approved_rpd",
                       source_type=s.license_type): added += 1
    for d in rpd.databases or []:
        if _add_if_new(db, keys, kind="database_name", value=d.name, source="approved_rpd", extra=d.url): added += 1
    for m in rpd.material_tech or []:
        if _add_if_new(db, keys, kind="equipment", value=m.equipment, source="approved_rpd"): added += 1
        if _add_if_new(db, keys, kind="room_type", value=m.room_type, source="approved_rpd"): added += 1
    for l in rpd.literature or []:
        url = (l.url or "").strip()
        mode = "electronic" if url else "printed"
        if _add_if_new(db, keys,
                       kind="literature_title", value=l.title,
                       source="approved_rpd", source_type=l.source_type, mode=mode,
                       id_discipline=discipline_id):
            added += 1
    for o in rpd.learning_outcomes or []:
        if _add_if_new(db, keys, kind="assessment_tool", value=o.assessment_tool, source="approved_rpd"):
            added += 1
        if _add_if_new(db, keys, kind="competency_code", value=o.competency_code, source="approved_rpd"):
            added += 1
        comp_code = _norm(o.competency_code) or None
        ind_code = _norm(o.indicator_code) or None
        if _add_if_new(db, keys, kind="indicator_code",
                       value=o.indicator_code, source="approved_rpd",
                       source_type=comp_code):
            added += 1
        if await _sync_indicator_description(db, o.indicator, o.indicator_description or "", direction_code):
            added += 1
        if await _upsert_indicator_description(
            db, value=o.indicator_description or "", source_type=ind_code,
            direction_code=direction_code, source="approved_rpd",
        ):
            added += 1
    return added


async def _dedupe_indicator_descriptions(db: AsyncSession) -> int:
    res = await db.execute(
        select(DictionaryEntry).where(DictionaryEntry.kind == "indicator_description")
    )
    rows = list(res.scalars().all())
    by_key: dict[tuple[str | None, str | None], list[DictionaryEntry]] = {}
    for r in rows:
        by_key.setdefault((r.source_type or None, r.direction_code or None), []).append(r)
    removed = 0
    for _key, entries in by_key.items():
        if len(entries) <= 1:
            continue
        real = [e for e in entries if not _is_placeholder(e.value)]
        placeholders = [e for e in entries if _is_placeholder(e.value)]
        if real:
            for e in placeholders:
                await db.delete(e)
                removed += 1
            continue
        keep = sorted(placeholders, key=lambda e: e.id_entry)[0]
        for e in placeholders:
            if e.id_entry != keep.id_entry:
                await db.delete(e)
                removed += 1
    return removed


async def _upgrade_placeholder_texts(db: AsyncSession) -> int:
    upgraded = 0
    res = await db.execute(
        select(CompetencyIndicator).where(
            func.lower(CompetencyIndicator.description).like("%требуется заполнение%")
        )
    )
    for ci in res.scalars().all():
        target = _placeholder_for(ci.code)
        if target and _norm(ci.description) != target:
            ci.description = target
            upgraded += 1

    res = await db.execute(
        select(DictionaryEntry).where(
            DictionaryEntry.kind == "indicator_description",
            DictionaryEntry.source_type.is_not(None),
            func.lower(DictionaryEntry.value).like("%требуется заполнение%"),
        )
    )
    for e in res.scalars().all():
        target = _placeholder_for(e.source_type)
        if target and _norm(e.value) != target:
            e.value = target
            upgraded += 1
    return upgraded


async def backfill_from_approved(db: AsyncSession) -> int:
    upgraded = await _upgrade_placeholder_texts(db)
    removed = await _dedupe_indicator_descriptions(db)
    keys = await _existing_keys(db)
    res = await db.execute(select(Rpd.id_rpd).where(Rpd.status == APPROVED_STATUS))
    ids = [row[0] for row in res.all()]
    total = 0
    for rid in ids:
        total += await harvest_rpd(db, rid, keys=keys)
    tools_res = await db.execute(select(AssessmentTool.name))
    for (name,) in tools_res.all():
        if _add_if_new(db, keys, kind="assessment_tool", value=name, source="manual"):
            total += 1
    comp_res = await db.execute(select(Competency.code))
    for (code,) in comp_res.all():
        if _add_if_new(db, keys, kind="competency_code", value=code, source="bup"):
            total += 1
    ind_res = await db.execute(
        select(CompetencyIndicator.code, Competency.code)
        .join(Competency, Competency.id_competency == CompetencyIndicator.id_competency)
    )
    for ind_code, comp_code in ind_res.all():
        if _add_if_new(db, keys, kind="indicator_code",
                       value=ind_code, source="bup",
                       source_type=_norm(comp_code) or None):
            total += 1
    if total or removed or upgraded:
        await db.commit()
    return total
