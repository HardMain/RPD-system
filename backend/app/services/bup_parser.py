"""Парсер XLS-файла базового учебного плана (БУП) ПНИПУ.

Структура листа «Дисциплины»:
- R1.C0  : 'Факультет: ...'
- R1.C8  : 'Направление подготовки: 38.03.04 Государственное и муниципальное управление'
- R2.C0  : 'Кафедра: ...'                  (выпускающая кафедра БУПа)
- R2.C8  : 'Профиль программы бакалавриата: ...'
- R4..R8 : шапка таблицы
- R≥11   : строки с дисциплинами и блоки-разделители
  - C0  Кафедра
  - C1  Индекс (Б1.Б.01)
  - C2  Наименование дисциплины
  - C3..C7  Виды контроля по семестрам (Экзамен/Диф.зач./Зач./Курс.пр./Курс.раб.)
            значение — номер семестра
  - C8  Всего часов
  - C9  Экзамен (часы)
  - C10 Аудиторные (всего)
  - C11 Лекции / C12 Лабораторные / C13 Практические / C14 КСР
  - C15 СРС
  - C16..C20  1 семестр   (Лекции, Лабораторные, Практические, КСР, СРС)
  - C21..C25  2 семестр  …  C51..C55 — 8 семестр
  - C56 Общая трудоёмкость, ЗЕ
  - C57 Код компетенции (через запятую)

Парсер устойчив к посторонним строкам (заголовки блоков, итоги). Дисциплинами
считаются строки, у которых заполнены C1 (индекс) и C2 (имя), и C8 (часы)
парсится как число.
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

import xlrd


CONTROL_LABELS = ["Экзамен", "Диф. зачет", "Зачёт", "Курсовой проект", "Курсовая работа"]
SEMESTER_BLOCK_START = 16  # C16 — начало 1 семестра
SEMESTER_BLOCK_WIDTH = 5   # 5 колонок на семестр (Лек/Лаб/Пр/КСР/СРС)
SEMESTER_BLOCKS = 8


@dataclass
class ParsedDiscipline:
    code: str
    name: str
    department: str | None = None
    control_form: str | None = None
    semester: str | None = None
    total_hours: int | None = None
    lecture_hours: int | None = None
    lab_hours: int | None = None
    practice_hours: int | None = None
    ksr_hours: int | None = None
    self_study_hours: int | None = None
    zet: int | None = None
    competency_codes: list[str] = field(default_factory=list)


@dataclass
class ParsedBup:
    direction_code: str | None = None
    direction_name: str | None = None
    profile: str | None = None
    faculty: str | None = None
    department_name: str | None = None
    disciplines: list[ParsedDiscipline] = field(default_factory=list)


# ── helpers ────────────────────────────────────────────────────────────────

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
    # Нормализуем дефис-минус и неразрывные пробелы.
    s = raw.replace("‑", "-").replace(" ", " ").replace(" ", " ")
    parts = re.split(r"[,;]\s*", s)
    return [p.strip() for p in parts if p.strip()]


_RE_DIRECTION = re.compile(r"Направление подготовки:\s*([\d.]+)\s+(.+)", re.IGNORECASE)
_RE_FACULTY = re.compile(r"Факультет:\s*(.+)", re.IGNORECASE)
_RE_DEPT = re.compile(r"Кафедра:\s*(.+)", re.IGNORECASE)
_RE_PROFILE = re.compile(r"Профиль[^:]*:\s*(.+)", re.IGNORECASE)


def _parse_meta(sheet) -> tuple[str | None, str | None, str | None, str | None, str | None]:
    """Возвращает (faculty, direction_code, direction_name, department_name, profile)."""
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
    """Из колонок C3-C7 собираем строку 'Экзамен (1), Зачёт (2)' и primary semester.

    primary semester — номер первого семестра, в котором что-либо сдаётся.
    """
    parts: list[str] = []
    primary_sem: str | None = None
    for label, c in zip(CONTROL_LABELS, range(3, 8)):
        if c >= len(row_vals):
            continue
        sem = _to_str(row_vals[c])
        if not sem:
            continue
        # Может быть несколько семестров через пробел/запятую: " 1, 2"
        sem_clean = re.sub(r"\s+", " ", sem.replace(",", " ")).strip()
        parts.append(f"{label} ({sem_clean})")
        if primary_sem is None:
            # первое числовое значение
            for token in sem_clean.split():
                if token.isdigit():
                    primary_sem = token
                    break
    return (", ".join(parts) or None, primary_sem)


def _semesters_used(row_vals: list) -> list[int]:
    """Возвращает список номеров семестров, у которых заполнен хотя бы один из
    Лек/Лаб/Пр/КСР/СРС в данной строке."""
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


# ── main entry ─────────────────────────────────────────────────────────────


def parse_bup_xls(content: bytes) -> ParsedBup:
    """Принимает байты xls-файла, возвращает ParsedBup."""
    wb = xlrd.open_workbook(file_contents=content)
    # Целевой лист — первый, чьё имя начинается на «Дисциплины», но НЕ
    # «Дисциплины по выбору» (тот тоже подгрузим, если будет необходимость).
    target_sheet = None
    for name in wb.sheet_names():
        if name.strip().lower().startswith("дисциплины") and "выбор" not in name.lower():
            target_sheet = wb.sheet_by_name(name)
            break
    if target_sheet is None:
        raise ValueError("В файле не найден лист «Дисциплины»")

    sh = target_sheet
    faculty, dcode, dname, dept_name, profile = _parse_meta(sh)
    parsed = ParsedBup(
        direction_code=dcode,
        direction_name=dname,
        profile=profile,
        faculty=faculty,
        department_name=dept_name,
    )

    # Найдём первую data-row: пропускаем шапку (R0..R10) и пустые строки.
    for r in range(11, sh.nrows):
        row = [sh.cell_value(r, c) for c in range(sh.ncols)]
        code = _to_str(row[1]) if len(row) > 1 else ""
        name = _to_str(row[2]) if len(row) > 2 else ""
        total = _to_int(row[8]) if len(row) > 8 else None

        # Это дисциплина? У неё есть индекс (C1) И название (C2) И числовое всего (C8)
        if not code or not name or total is None:
            continue
        # Игнорируем строки-агрегаты вроде «Дисциплины по выбору» в C2 без C1 — но
        # если C1 пустое мы уже отфильтровали выше.

        control_form, primary_sem = _build_control_form(row)

        # Если primary_sem не нашёлся в C3-C7, попробуем выудить из ненулевых
        # семестровых блоков (часто для практик).
        if primary_sem is None:
            sems = _semesters_used(row)
            if sems:
                primary_sem = ", ".join(str(s) for s in sems)

        comp_codes = _split_competencies(_to_str(row[57]) if len(row) > 57 else "")

        parsed.disciplines.append(ParsedDiscipline(
            code=code,
            name=name,
            department=_to_str(row[0]) or None,
            control_form=control_form,
            semester=primary_sem,
            total_hours=total,
            lecture_hours=_to_int(row[11]) if len(row) > 11 else None,
            lab_hours=_to_int(row[12]) if len(row) > 12 else None,
            practice_hours=_to_int(row[13]) if len(row) > 13 else None,
            ksr_hours=_to_int(row[14]) if len(row) > 14 else None,
            self_study_hours=_to_int(row[15]) if len(row) > 15 else None,
            zet=_to_int(row[56]) if len(row) > 56 else None,
            competency_codes=comp_codes,
        ))

    return parsed
