from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

import xlrd

CONTROL_LABELS = ["Экзамен", "Диф. зачет", "Зачёт", "Курсовой проект", "Курсовая работа"]
SEMESTER_BLOCK_START = 16
SEMESTER_BLOCK_WIDTH = 5
SEMESTER_BLOCKS = 8

@dataclass
class ParsedSemester:
    number: int
    lecture_hours: int | None = None
    lab_hours: int | None = None
    practice_hours: int | None = None
    ksr_hours: int | None = None
    self_study_hours: int | None = None

@dataclass
class ParsedDiscipline:
    code: str
    name: str
    department: str | None = None
    control_form: str | None = None
    semester: str | None = None
    total_hours: int | None = None
    exam_hours: int | None = None
    lecture_hours: int | None = None
    lab_hours: int | None = None
    practice_hours: int | None = None
    ksr_hours: int | None = None
    self_study_hours: int | None = None
    zet: int | None = None
    competency_codes: list[str] = field(default_factory=list)
    semesters: list[ParsedSemester] = field(default_factory=list)

@dataclass
class ParsedBup:
    direction_code: str | None = None
    direction_name: str | None = None
    profile: str | None = None
    faculty: str | None = None
    department_name: str | None = None
    disciplines: list[ParsedDiscipline] = field(default_factory=list)

def _to_int(value) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(round(float(str(value).replace(",", ".").strip())))
    except (TypeError, ValueError):
        return None

def _to_str(value) -> str:
    if value is None:
        return ""
    return str(value).strip()

def _split_competencies(raw: str) -> list[str]:
    if not raw:
        return []
    s = raw.replace("‑", "-").replace(" ", " ").replace(" ", " ")
    parts = re.split(r"[,;]\s*", s)
    return [p.strip() for p in parts if p.strip()]

_RE_DIRECTION = re.compile(r"Направление подготовки:\s*([\d.]+)\s+(.+)", re.IGNORECASE)
_RE_FACULTY = re.compile(r"Факультет:\s*(.+)", re.IGNORECASE)
_RE_DEPT = re.compile(r"Кафедра:\s*(.+)", re.IGNORECASE)
_RE_PROFILE = re.compile(r"Профиль[^:]*:\s*(.+)", re.IGNORECASE)

def _parse_meta(sheet) -> tuple[str | None, str | None, str | None, str | None, str | None]:
    faculty = direction_code = direction_name = department_name = profile = None
    for r in range(min(6, sheet.nrows)):
        for c in range(min(20, sheet.ncols)):
            v = _to_str(sheet.cell_value(r, c))
            if not v:
                continue
            if (m := _RE_DIRECTION.search(v)):
                direction_code = m.group(1).strip()
                direction_name = m.group(2).strip()
            elif (m := _RE_FACULTY.search(v)):
                faculty = m.group(1).strip()
            elif (m := _RE_DEPT.search(v)) and not department_name:
                department_name = m.group(1).strip()
            elif (m := _RE_PROFILE.search(v)):
                profile = m.group(1).strip()
    return faculty, direction_code, direction_name, department_name, profile

def _build_control_form(row_vals: list) -> tuple[str | None, str | None]:
    parts: list[str] = []
    primary_sem: str | None = None
    for label, c in zip(CONTROL_LABELS, range(3, 8)):
        if c >= len(row_vals):
            continue
        sem = _to_str(row_vals[c])
        if not sem:
            continue
        sem_clean = re.sub(r"\s+", " ", sem.replace(",", " ")).strip()
        parts.append(f"{label} ({sem_clean})")
        if primary_sem is None:
            for token in sem_clean.split():
                if token.isdigit():
                    primary_sem = token
                    break
    return (", ".join(parts) or None, primary_sem)

def _semesters_used(row_vals: list) -> list[int]:
    used = []
    for i in range(SEMESTER_BLOCKS):
        base = SEMESTER_BLOCK_START + i * SEMESTER_BLOCK_WIDTH
        for off in range(SEMESTER_BLOCK_WIDTH):
            if base + off >= len(row_vals):
                break
            if _to_int(row_vals[base + off]):
                used.append(i + 1)
                break
    return used

def _extract_semesters(row_vals: list) -> list[ParsedSemester]:
    out: list[ParsedSemester] = []
    for i in range(SEMESTER_BLOCKS):
        base = SEMESTER_BLOCK_START + i * SEMESTER_BLOCK_WIDTH
        if base + SEMESTER_BLOCK_WIDTH > len(row_vals):
            break
        vals = [_to_int(row_vals[base + off]) for off in range(SEMESTER_BLOCK_WIDTH)]
        if not any(v for v in vals):
            continue
        out.append(ParsedSemester(
            number=i + 1,
            lecture_hours=vals[0],
            lab_hours=vals[1],
            practice_hours=vals[2],
            ksr_hours=vals[3],
            self_study_hours=vals[4],
        ))
    return out

def parse_bup_xls(content: bytes) -> ParsedBup:
    wb = xlrd.open_workbook(file_contents=content)
    target_sheet = None
    for name in wb.sheet_names():
        low = name.strip().lower()
        if "выбор" in low:
            continue
        if low.startswith("дисциплины") or low == "план":
            target_sheet = wb.sheet_by_name(name)
            break
    if target_sheet is None:
        raise ValueError("В файле не найден лист «Дисциплины» / «План»")

    sh = target_sheet
    faculty, dcode, dname, dept_name, profile = _parse_meta(sh)
    parsed = ParsedBup(
        direction_code=dcode,
        direction_name=dname,
        profile=profile,
        faculty=faculty,
        department_name=dept_name,
    )

    for r in range(11, sh.nrows):
        row = [sh.cell_value(r, c) for c in range(sh.ncols)]
        code = _to_str(row[1]) if len(row) > 1 else ""
        name = _to_str(row[2]) if len(row) > 2 else ""
        total = _to_int(row[8]) if len(row) > 8 else None

        if not code or not name or total is None:
            continue

        control_form, primary_sem = _build_control_form(row)

        if primary_sem is None:
            sems = _semesters_used(row)
            if sems:
                primary_sem = ", ".join(str(s) for s in sems)

        comp_codes = _split_competencies(_to_str(row[57]) if len(row) > 57 else "")
        semesters = _extract_semesters(row)
        if primary_sem is None and semesters:
            primary_sem = ", ".join(str(s.number) for s in semesters)

        parsed.disciplines.append(ParsedDiscipline(
            code=code,
            name=name,
            department=_to_str(row[0]) or None,
            control_form=control_form,
            semester=primary_sem,
            total_hours=total,
            exam_hours=_to_int(row[9]) if len(row) > 9 else None,
            lecture_hours=_to_int(row[11]) if len(row) > 11 else None,
            lab_hours=_to_int(row[12]) if len(row) > 12 else None,
            practice_hours=_to_int(row[13]) if len(row) > 13 else None,
            ksr_hours=_to_int(row[14]) if len(row) > 14 else None,
            self_study_hours=_to_int(row[15]) if len(row) > 15 else None,
            zet=_to_int(row[56]) if len(row) > 56 else None,
            competency_codes=comp_codes,
            semesters=semesters,
        ))

    return parsed
