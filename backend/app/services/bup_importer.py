from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Bup, BupDiscipline, BupDisciplineCompetency,
    Direction, Discipline, Competency, CompetencyIndicator, Department,
)
from app.services.bup_parser import ParsedBup, ParsedDiscipline, ParsedSemester

def _normalize_competency_code(code: str) -> str:
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

def _normalize_discipline_name(raw: str) -> str:
    if not raw:
        return ""
    s = raw.replace(" ", " ").replace(" ", " ").replace(" ", " ")
    s = " ".join(s.split())
    s = _fix_latin_homoglyphs(s)
    return s

_LATIN_TO_CYRILLIC_HOMOGLYPHS = {
    "A": "А", "a": "а", "B": "В", "C": "С", "c": "с", "E": "Е", "e": "е",
    "H": "Н", "K": "К", "M": "М", "O": "О", "o": "о", "P": "Р", "p": "р",
    "T": "Т", "X": "Х", "x": "х", "y": "у", "Y": "У",
}

def _fix_latin_homoglyphs(s: str) -> str:
    def is_cyr(ch: str) -> bool:
        return "Ѐ" <= ch <= "ӿ"
    out: list[str] = []
    for i, ch in enumerate(s):
        cyr = _LATIN_TO_CYRILLIC_HOMOGLYPHS.get(ch)
        if cyr is not None:
            left = s[i - 1] if i > 0 else ""
            right = s[i + 1] if i + 1 < len(s) else ""
            if is_cyr(left) or is_cyr(right):
                out.append(cyr)
                continue
        out.append(ch)
    return "".join(out)

async def _get_or_create_discipline(db: AsyncSession, name: str) -> Discipline:
    name = _normalize_discipline_name(name)
    if not name:
        raise ValueError("Имя дисциплины пустое после нормализации")
    res = await db.execute(select(Discipline).where(Discipline.name == name))
    d = res.scalars().first()
    if d:
        return d
    d = Discipline(name=name)
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
        .options(selectinload(Competency.indicators))
    )
    c = res.scalars().first()
    if c:
        await _ensure_at_least_one_indicator(db, c)
        return c
    c = Competency(code=code, name="(требуется заполнение)", id_direction=id_direction)
    db.add(c)
    await db.flush()
    await _ensure_at_least_one_indicator(db, c)
    return c

async def _ensure_at_least_one_indicator(db: AsyncSession, comp: Competency) -> None:
    res = await db.execute(
        select(CompetencyIndicator).where(CompetencyIndicator.id_competency == comp.id_competency).limit(1)
    )
    if res.scalar_one_or_none() is not None:
        return
    db.add(CompetencyIndicator(
        id_competency=comp.id_competency,
        code=f"{comp.code}.1",
        description="(требуется заполнение)",
    ))
    await db.flush()

def _semesters_to_jsonb(semesters: list[ParsedSemester]) -> list[dict] | None:
    if not semesters:
        return None
    return [
        {
            "number": s.number,
            "lecture": s.lecture_hours,
            "lab": s.lab_hours,
            "practice": s.practice_hours,
            "ksr": s.ksr_hours,
            "srs": s.self_study_hours,
        }
        for s in semesters
    ]

def _build_bup_name(parsed: ParsedBup, year: int | None) -> str:
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
    direction = await _get_or_create_direction(
        db, parsed.direction_code, parsed.direction_name, parsed.profile,
    )
    name = name_override or _build_bup_name(parsed, year)

    res = await db.execute(
        select(Bup)
        .where(Bup.id_direction == direction.id_direction)
        .where(Bup.name == name)
        .where(Bup.year == year if year is not None else Bup.year.is_(None))
        .options(
            selectinload(Bup.disciplines).selectinload(BupDiscipline.competencies),
        )
    )
    bup = res.scalars().first()
    if bup is None:
        bup = Bup(
            id_direction=direction.id_direction,
            name=name, year=year,
            faculty=parsed.faculty, profile=parsed.profile,
            form_of_study=parsed.form_of_study,
            id_source_file=id_source_file,
        )
        db.add(bup)
        await db.flush()
        existing_by_code: dict[str, BupDiscipline] = {}
    else:
        if id_source_file is not None:
            bup.id_source_file = id_source_file
        if parsed.faculty:
            bup.faculty = parsed.faculty
        if parsed.profile:
            bup.profile = parsed.profile
        if parsed.form_of_study:
            bup.form_of_study = parsed.form_of_study
        existing_by_code = {(bd.code or ""): bd for bd in bup.disciplines}

    fallback_dept = await _get_or_create_department(
        db, parsed.department_name, parsed.faculty,
    )

    seen_codes: set[str] = set()
    for pd in parsed.disciplines:
        disc = await _get_or_create_discipline(db, pd.name)
        dept = (
            await _get_or_create_department(db, pd.department, parsed.faculty)
            if pd.department else fallback_dept
        )
        existing = existing_by_code.get(pd.code or "")
        sems_jsonb = _semesters_to_jsonb(pd.semesters)
        if existing is not None:
            seen_codes.add(pd.code or "")
            existing.id_discipline = disc.id_discipline
            existing.id_department = dept.id_department if dept else None
            existing.semester = pd.semester
            existing.control_form = pd.control_form
            existing.total_hours = pd.total_hours
            existing.exam_hours = pd.exam_hours
            existing.lecture_hours = pd.lecture_hours
            existing.lab_hours = pd.lab_hours
            existing.practice_hours = pd.practice_hours
            existing.ksr_hours = pd.ksr_hours
            existing.self_study_hours = pd.self_study_hours
            existing.zet = pd.zet
            existing.semesters_data = sems_jsonb
            for link in list(existing.competencies):
                await db.delete(link)
            await db.flush()
            bd = existing
        else:
            bd = BupDiscipline(
                id_bup=bup.id_bup,
                id_discipline=disc.id_discipline,
                id_department=dept.id_department if dept else None,
                code=pd.code,
                semester=pd.semester,
                control_form=pd.control_form,
                total_hours=pd.total_hours,
                exam_hours=pd.exam_hours,
                lecture_hours=pd.lecture_hours,
                lab_hours=pd.lab_hours,
                practice_hours=pd.practice_hours,
                ksr_hours=pd.ksr_hours,
                self_study_hours=pd.self_study_hours,
                zet=pd.zet,
                semesters_data=sems_jsonb,
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

    if existing_by_code:
        for code, bd in existing_by_code.items():
            if code not in seen_codes:
                await db.delete(bd)
        await db.flush()

    await db.flush()
    return bup
