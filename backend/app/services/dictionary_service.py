from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Rpd, RpdSoftware, RpdDatabase, RpdMaterialTech, RpdLiterature,
    RpdLearningOutcome, AssessmentTool, DictionaryEntry,
    Competency, CompetencyIndicator,
)

APPROVED_STATUS = "Согласовано"


def _norm(value: str | None) -> str:
    return (value or "").strip()


async def _existing_keys(db: AsyncSession) -> set[tuple]:
    res = await db.execute(select(
        DictionaryEntry.kind,
        DictionaryEntry.value,
        DictionaryEntry.source_type,
        DictionaryEntry.mode,
    ))
    keys = set()
    for kind, value, st, md in res.all():
        keys.add((kind, value.strip().lower(), (st or "").strip().lower(), (md or "").strip().lower()))
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
) -> bool:
    v = _norm(value)
    if not v:
        return False
    if "требуется заполнение" in v.lower():
        return False
    st = _norm(source_type) or None
    md = _norm(mode) or None
    key = (kind, v.lower(), (st or "").lower(), (md or "").lower())
    if key in keys:
        return False
    keys.add(key)
    db.add(DictionaryEntry(
        kind=kind, value=v, source_type=st, mode=md, source=source,
    ))
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
            selectinload(Rpd.learning_outcomes),
        )
    )
    rpd = res.scalar_one_or_none()
    if rpd is None:
        return 0
    added = 0
    for s in rpd.software or []:
        if _add_if_new(db, keys, kind="software_name", value=s.name, source="approved_rpd"): added += 1
        if _add_if_new(db, keys, kind="software_purpose", value=s.purpose, source="approved_rpd"): added += 1
    for d in rpd.databases or []:
        if _add_if_new(db, keys, kind="database_name", value=d.name, source="approved_rpd"): added += 1
    for m in rpd.material_tech or []:
        if _add_if_new(db, keys, kind="equipment", value=m.equipment, source="approved_rpd"): added += 1
        if _add_if_new(db, keys, kind="room_type", value=m.room_type, source="approved_rpd"): added += 1
    for l in rpd.literature or []:
        url = (l.url or "").strip()
        mode = "electronic" if url else "printed"
        if _add_if_new(db, keys,
                       kind="literature_title", value=l.title,
                       source="approved_rpd", source_type=l.source_type, mode=mode):
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
        if _add_if_new(db, keys, kind="indicator_description",
                       value=o.indicator_description, source="approved_rpd",
                       source_type=ind_code):
            added += 1
    return added


async def backfill_from_approved(db: AsyncSession) -> int:
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
        if _add_if_new(db, keys, kind="competency_code", value=code, source="manual"):
            total += 1
    ind_res = await db.execute(
        select(CompetencyIndicator.code, CompetencyIndicator.description, Competency.code)
        .join(Competency, Competency.id_competency == CompetencyIndicator.id_competency)
    )
    for ind_code, desc, comp_code in ind_res.all():
        if _add_if_new(db, keys, kind="indicator_code",
                       value=ind_code, source="manual",
                       source_type=_norm(comp_code) or None):
            total += 1
        if _add_if_new(db, keys, kind="indicator_description",
                       value=desc, source="manual",
                       source_type=_norm(ind_code) or None):
            total += 1
    if total:
        await db.commit()
    return total
