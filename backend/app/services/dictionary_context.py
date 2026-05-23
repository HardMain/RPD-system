from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DictionaryEntry
from app.services.structured_generation import _PRINTED_SOURCE_TYPES

_CATALOG_CHAR_LIMIT = 3000

_SOFTWARE_HEADER = (
    "Справочник наименований ПО (реальные записи из согласованных РПД университета). "
    "Если по смыслу подходит — бери ТОЧНОЕ полное наименование из справочника, "
    "не сокращай и не переименовывай (например, вместо «Debian» — полную запись из списка). "
    "Поле license_type указывай равным названию вида в квадратных скобках:"
)
_DATABASE_HEADER = (
    "Справочник наименований БД и ИСС (реальные записи из согласованных РПД университета). "
    "Если по смыслу подходит — бери ТОЧНОЕ полное наименование и ссылку из справочника, "
    "не сокращай и не переименовывай:"
)
_MTECH_HEADER = (
    "Справочник типов помещений и оборудования (реальные записи из согласованных РПД). "
    "Если по смыслу подходит — бери формулировки из справочника, не переименовывай:"
)
_LITERATURE_HEADER = (
    "Справочник литературы по этой дисциплине (реальные записи из согласованных РПД). "
    "Если издание подходит — бери ТОЧНОЕ библиографическое описание из справочника:"
)


async def _distinct_values(db: AsyncSession, kind: str, limit: int = 60) -> list[str]:
    res = await db.execute(
        select(DictionaryEntry.value)
        .where(DictionaryEntry.kind == kind)
        .where(DictionaryEntry.value.is_not(None))
        .where(func.length(func.trim(DictionaryEntry.value)) > 0)
        .group_by(DictionaryEntry.value)
        .order_by(func.lower(DictionaryEntry.value))
        .limit(limit)
    )
    return [v.strip() for (v,) in res.all() if v and v.strip()]


async def _software_block(db: AsyncSession) -> str | None:
    res = await db.execute(
        select(DictionaryEntry.value, DictionaryEntry.source_type)
        .where(DictionaryEntry.kind == "software_name")
        .where(DictionaryEntry.value.is_not(None))
        .where(func.length(func.trim(DictionaryEntry.value)) > 0)
        .order_by(
            func.lower(func.coalesce(DictionaryEntry.source_type, "")),
            func.lower(DictionaryEntry.value),
        )
    )
    by_type: dict[str, list[str]] = {}
    seen: set[str] = set()
    for value, stype in res.all():
        v = (value or "").strip()
        if not v:
            continue
        key = v.lower()
        if key in seen:
            continue
        seen.add(key)
        by_type.setdefault((stype or "").strip(), []).append(v)
    if not by_type:
        return None
    lines = [_SOFTWARE_HEADER]
    for stype in sorted(by_type, key=str.lower):
        lines.append(f"[{stype or 'Без вида'}]")
        lines.extend(f"  - {v}" for v in by_type[stype])
    return "\n".join(lines)


async def _database_block(db: AsyncSession) -> str | None:
    res = await db.execute(
        select(DictionaryEntry.value, func.max(DictionaryEntry.extra))
        .where(DictionaryEntry.kind == "database_name")
        .where(DictionaryEntry.value.is_not(None))
        .where(func.length(func.trim(DictionaryEntry.value)) > 0)
        .group_by(DictionaryEntry.value)
        .order_by(func.lower(DictionaryEntry.value))
    )
    rows = [(v.strip(), (u or "").strip()) for v, u in res.all() if v and v.strip()]
    if not rows:
        return None
    lines = [_DATABASE_HEADER]
    for value, url in rows:
        lines.append(f"  - {value}" + (f" — {url}" if url else ""))
    return "\n".join(lines)


async def _material_tech_block(db: AsyncSession) -> str | None:
    rooms = await _distinct_values(db, "room_type")
    equipment = await _distinct_values(db, "equipment")
    if not rooms and not equipment:
        return None
    lines = [_MTECH_HEADER]
    if rooms:
        lines.append("Типы помещений:")
        lines.extend(f"  - {v}" for v in rooms)
    if equipment:
        lines.append("Оборудование:")
        lines.extend(f"  - {v}" for v in equipment)
    return "\n".join(lines)


async def _literature_block(db: AsyncSession, section_key: str, discipline_id: int | None) -> str | None:
    if discipline_id is None:
        return None
    stmt = (
        select(DictionaryEntry.value)
        .where(DictionaryEntry.kind == "literature_title")
        .where(DictionaryEntry.id_discipline == discipline_id)
        .where(DictionaryEntry.value.is_not(None))
        .where(func.length(func.trim(DictionaryEntry.value)) > 0)
    )
    if section_key == "literature_electronic":
        stmt = stmt.where(DictionaryEntry.mode == "electronic")
    else:
        source_type = _PRINTED_SOURCE_TYPES.get(section_key)
        if not source_type:
            return None
        stmt = stmt.where(DictionaryEntry.source_type == source_type)
    stmt = stmt.group_by(DictionaryEntry.value).order_by(func.lower(DictionaryEntry.value))
    res = await db.execute(stmt)
    values = [v.strip() for (v,) in res.all() if v and v.strip()]
    if not values:
        return None
    lines = [_LITERATURE_HEADER]
    lines.extend(f"  - {v}" for v in values)
    return "\n".join(lines)


async def dictionary_catalog(
    db: AsyncSession, section_key: str, discipline_id: int | None = None
) -> tuple[str, str] | None:
    if section_key == "software":
        block, label = await _software_block(db), "Справочник наименований ПО"
    elif section_key == "databases":
        block, label = await _database_block(db), "Справочник наименований БД и ИСС"
    elif section_key == "material_tech":
        block, label = await _material_tech_block(db), "Справочник помещений и оборудования"
    elif section_key == "literature_electronic" or section_key in _PRINTED_SOURCE_TYPES:
        block, label = await _literature_block(db, section_key, discipline_id), "Справочник литературы дисциплины"
    else:
        return None
    if not block:
        return None
    return block[:_CATALOG_CHAR_LIMIT], label
