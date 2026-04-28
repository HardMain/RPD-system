"""Импортёр распарсенного БУПа в БД.

Превращает `ParsedBup` в записи `Bup`, `BupDiscipline`, `BupDisciplineCompetency`,
а также при необходимости создаёт справочные `Direction`, `Discipline`,
`Competency`, `Department`. Идемпотентен по паре `(name, year, id_direction)`:
если БУП с тем же именем и годом для направления уже есть, импорт перевыкатывает
его дисциплины (старые удаляются каскадом).
"""
from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Bup, BupDiscipline, BupDisciplineCompetency,
    Direction, Discipline, Competency, Department,
)
from app.services.bup_parser import ParsedBup, ParsedDiscipline


def _normalize_competency_code(code: str) -> str:
    """Привести код к канонической форме: 'ОК-2', 'ОПК-1', 'ПК-23', 'ПСК-1'.

    XLS использует неразрывный дефис ‑, лишние пробелы — нормализуем."""
    s = code.replace("‑", "-").strip()
    s = re.sub(r"\s+", "", s)
    return s


async def _get_or_create_direction(
    db: AsyncSession, code: str | None, name: str | None, profile: str | None
) -> Direction:
    if not code and not name:
        raise ValueError("В БУПе не удалось определить направление подготовки")
    q = select(Direction)
    if code:
        q = q.where(Direction.code == code)
    elif name:
        q = q.where(Direction.name == name)
    res = await db.execute(q)
    d = res.scalars().first()
    if d:
        # обновим профиль, если был не задан
        if profile and not d.profile:
            d.profile = profile
        return d
    d = Direction(
        code=code or "—",
        name=name or "—",
        profile=profile,
        degree_level="бакалавриат",
    )
    db.add(d)
    await db.flush()
    return d


async def _get_or_create_discipline(
    db: AsyncSession, name: str, id_direction: int
) -> Discipline:
    res = await db.execute(
        select(Discipline)
        .where(Discipline.name == name)
        .where(Discipline.id_direction == id_direction)
    )
    d = res.scalars().first()
    if d:
        return d
    d = Discipline(name=name, id_direction=id_direction)
    db.add(d)
    await db.flush()
    return d


async def _get_or_create_department(
    db: AsyncSession, name: str | None, faculty: str | None,
) -> Department | None:
    if not name:
        return None
    res = await db.execute(select(Department).where(Department.name == name))
    d = res.scalars().first()
    if d:
        return d
    d = Department(name=name, faculty=faculty)
    db.add(d)
    await db.flush()
    return d


async def _get_or_create_competency(
    db: AsyncSession, code: str, id_direction: int
) -> Competency:
    res = await db.execute(
        select(Competency)
        .where(Competency.code == code)
        .where(Competency.id_direction == id_direction)
    )
    c = res.scalars().first()
    if c:
        return c
    # Имя пока не знаем — placeholder; админ может дозаполнить вручную позже.
    c = Competency(code=code, name="(требуется заполнение)", id_direction=id_direction)
    db.add(c)
    await db.flush()
    return c


def _build_bup_name(parsed: ParsedBup, year: int | None) -> str:
    """Сборка человекочитаемого имени БУПа: '2024 ЭТФ ПИ б (полный)'."""
    parts: list[str] = []
    if year:
        parts.append(str(year))
    if parsed.faculty:
        parts.append(parsed.faculty)
    if parsed.profile:
        parts.append(parsed.profile)
    elif parsed.direction_name:
        parts.append(parsed.direction_name)
    return " — ".join(parts) or "Без названия"


async def import_parsed_bup(
    db: AsyncSession,
    parsed: ParsedBup,
    *,
    year: int | None = None,
    name_override: str | None = None,
    id_source_file: int | None = None,
) -> Bup:
    """Импортировать ParsedBup в БД и вернуть созданный/обновлённый Bup.

    Идемпотентность: ищем существующий БУП по (name, year, id_direction). Если
    найден — пересоздаём его дисциплины (cascade удаляет старые links).
    """
    direction = await _get_or_create_direction(
        db, parsed.direction_code, parsed.direction_name, parsed.profile,
    )
    name = name_override or _build_bup_name(parsed, year)

    # Идемпотентный поиск
    res = await db.execute(
        select(Bup)
        .where(Bup.id_direction == direction.id_direction)
        .where(Bup.name == name)
        .where(Bup.year == year if year is not None else Bup.year.is_(None))
    )
    bup = res.scalars().first()
    if bup is None:
        bup = Bup(
            id_direction=direction.id_direction,
            name=name, year=year,
            faculty=parsed.faculty, profile=parsed.profile,
            id_source_file=id_source_file,
        )
        db.add(bup)
        await db.flush()
    else:
        # Сбросим существующие BupDiscipline (cascade подчистит competency-link).
        for bd in list(bup.disciplines):
            await db.delete(bd)
        await db.flush()
        if id_source_file is not None:
            bup.id_source_file = id_source_file

    fallback_dept = await _get_or_create_department(
        db, parsed.department_name, parsed.faculty,
    )

    for pd in parsed.disciplines:
        disc = await _get_or_create_discipline(db, pd.name, direction.id_direction)
        dept = (
            await _get_or_create_department(db, pd.department, parsed.faculty)
            if pd.department else fallback_dept
        )
        bd = BupDiscipline(
            id_bup=bup.id_bup,
            id_discipline=disc.id_discipline,
            id_department=dept.id_department if dept else None,
            code=pd.code,
            semester=pd.semester,
            control_form=pd.control_form,
            total_hours=pd.total_hours,
            lecture_hours=pd.lecture_hours,
            lab_hours=pd.lab_hours,
            practice_hours=pd.practice_hours,
            ksr_hours=pd.ksr_hours,
            self_study_hours=pd.self_study_hours,
            zet=pd.zet,
        )
        db.add(bd)
        await db.flush()

        for raw_code in pd.competency_codes:
            code = _normalize_competency_code(raw_code)
            if not code:
                continue
            comp = await _get_or_create_competency(db, code, direction.id_direction)
            db.add(BupDisciplineCompetency(
                id_bup_discipline=bd.id_bup_discipline,
                id_competency=comp.id_competency,
            ))

    await db.flush()
    return bup
