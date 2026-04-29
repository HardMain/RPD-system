"""Маппер из ORM-моделей RPD в контекст для DOCX-шаблона.

Шаблон ожидает структуру, описанную в Maket_RPD_UIR_24.12.2018.docx
(см. README ядра ренderer'а). Эта функция превращает данные из БД в эту структуру.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any


def _safe(value: Any, default: Any = "") -> Any:
    if value is None:
        return default
    return value


def _ze(hours: int | None) -> int:
    """Зачётные единицы = часы / 36 (округление к ближайшему)."""
    if not hours:
        return 0
    return round(hours / 36)


def _parse_semester(raw: Any) -> int:
    """Извлечь номер семестра из строки вида '1', '1-2', '7'."""
    if raw is None:
        return 1
    s = str(raw).strip()
    for token in s.replace(",", "-").split("-"):
        token = token.strip()
        if token.isdigit():
            return int(token)
    return 1


# ─────────────────────────────────────────────────────────────────────────────


def build_context(rpd, bd=None) -> dict:
    """rpd — объект ORM Rpd с подгруженными связями. Возвращает dict под docxtpl.

    `bd` — конкретная привязанная BupDiscipline, для которой формируется печатная
    форма (титульник, направление/профиль, часы раздела 3, фильтрация раздела 2
    по её компетенциям). Если не передана — берётся первая привязанная
    («представительная»), как было до multi-БУП. Так один макет даёт N печатных
    форм — по одной на каждую привязку, отличающихся титульником и индикаторами,
    но с общим содержимым (разделы, литература, методички, ПО, МТО, ФОС)."""
    d = rpd.discipline
    if bd is None:
        bd = next(
            (l.bup_discipline for l in (rpd.bup_links or []) if l.bup_discipline),
            None,
        )
    direction = bd.bup.direction if bd and bd.bup else None
    bup_profile = bd.bup.profile if bd and bd.bup else None
    # Множество индикаторов, которые относятся к компетенциям ВЫБРАННОЙ
    # БУП-дисциплины (нужно для фильтрации раздела 2 в печатной форме).
    bd_indicator_ids: set[int] | None = None
    if bd is not None:
        bd_competency_ids = {bdc.id_competency for bdc in (bd.competencies or [])}
        if bd_competency_ids:
            bd_indicator_ids = set()
            for lo in (rpd.learning_outcomes or []):
                ind = lo.indicator
                if ind and ind.competency and ind.competency.id_competency in bd_competency_ids:
                    bd_indicator_ids.add(ind.id_indicator)

    total_hours = _safe(bd.total_hours if bd else 0, 0)
    lec = _safe(bd.lecture_hours if bd else 0, 0)
    pr = _safe(bd.practice_hours if bd else 0, 0)
    lab = _safe(bd.lab_hours if bd else 0, 0)
    srs = _safe(bd.self_study_hours if bd else 0, 0)
    contact = lec + pr + lab

    # Контрольная форма: распределение часов по типу контроля
    control = ((bd.control_form if bd else "") or "").lower()
    exam_h = 9 if "экз" in control else 0
    diff_credit_h = 0
    credit_h = 0
    if "диф" in control and "зач" in control:
        diff_credit_h = 0  # часы не выделяются, отметка
    elif "зач" in control:
        credit_h = 0

    sem_num = _parse_semester(bd.semester if bd else None)

    # ── Workload: текущий семестр + 7 пустых слотов = всего 8 столбцов ─────
    semester_block = {
        "number": sem_num,
        "contact": contact,
        "lectures": lec,
        "labs": lab,
        "practice": pr,
        "ksr": 0,
        "control_work": 0,
        "srs": srs,
        "exam": exam_h,
        "diff_credit": diff_credit_h,
        "credit": credit_h,
        "course_project": 0,
        "course_work": 0,
        "total": total_hours,
    }
    workload = {
        "total": dict(semester_block, number="Итого"),
        "semesters": [semester_block],
    }

    # ── Результаты обучения ────────────────────────────────────────────────
    # Если нам передали конкретную БУП-дисциплину — печатаем только её
    # индикаторы (раздел 2 в АРМ для каждой привязки свой).
    learning_outcomes = []
    for lo in (rpd.learning_outcomes or []):
        ind = lo.indicator
        if bd_indicator_ids is not None and ind and ind.id_indicator not in bd_indicator_ids:
            continue
        comp = ind.competency if ind else None
        learning_outcomes.append({
            "competency_code": comp.code if comp else "",
            "indicator_code": ind.code if ind else "",
            "outcome_text": _safe(lo.outcome_text, "—"),
            "indicator_description": ind.description if ind else "",
            "assessment_tool": _safe(lo.assessment_tool, "—"),
        })

    # ── Содержание дисциплины (разделы по семестрам) ──────────────────────
    sections = []
    tot_lec = tot_lab = tot_pr = tot_srs = 0
    for s in (rpd.sections or []):
        sl = _safe(s.lecture_hours, 0)
        sp = _safe(s.practice_hours, 0)
        slb = _safe(s.lab_hours, 0)
        ss = _safe(s.self_study_hours, 0)
        tot_lec += sl
        tot_pr += sp
        tot_lab += slb
        tot_srs += ss
        sections.append({
            "name": s.title,
            "description": _safe(s.brief_content, ""),
            "lectures": sl,
            "labs": slb,
            "practice": sp,
            "srs": ss,
        })
    discipline_semesters = [{
        "number": sem_num,
        "sections": sections,
        "total_lectures": tot_lec,
        "total_labs": tot_lab,
        "total_practice": tot_pr,
        "total_srs": tot_srs,
    }]
    total = {
        "lectures": tot_lec,
        "labs": tot_lab,
        "practice": tot_pr,
        "srs": tot_srs,
    }

    # ── Темы лабораторных и практических ──────────────────────────────────
    lab_topics, prac_topics = [], []
    for s in (rpd.sections or []):
        for t in (s.topics or []):
            tt = (t.topic_type or "").lower()
            if tt in ("lab", "лр", "лаб", "laboratory"):
                lab_topics.append(t.title)
            elif tt in ("practice", "пз", "практика", "seminar"):
                prac_topics.append(t.title)

    practical_topics = [
        {"index": i, "title": t} for i, t in enumerate(prac_topics, 1)
    ]
    lab_topics_list = [
        {"index": i, "title": t} for i, t in enumerate(lab_topics, 1)
    ]

    # ── Литература ─────────────────────────────────────────────────────────
    def _mk_citation(l) -> str:
        parts = []
        if l.authors:
            parts.append(l.authors)
        if l.title:
            parts.append(l.title)
        ref = " ".join(parts)
        tail = []
        if l.publisher:
            tail.append(l.publisher)
        if l.year:
            tail.append(str(l.year))
        if tail:
            ref += " — " + ", ".join(tail)
        return (ref or "—").rstrip(".") + "."

    lit_main, lit_extra, lit_el = [], [], []
    for l in (rpd.literature or []):
        st = (l.source_type or "").lower()
        if l.url:
            lit_el.append({
                "els_type": l.source_type or "Дополнительная",
                "title": _mk_citation(l),
                "url": l.url,
                "access": "локальная сеть; свободный доступ",
            })
        elif "осн" in st:
            lit_main.append({
                "number": len(lit_main) + 1,
                "citation": _mk_citation(l),
                "copies_count": _safe(l.copies_count, "—"),
            })
        else:
            lit_extra.append({
                "number": len(lit_extra) + 1,
                "citation": _mk_citation(l),
                "copies_count": _safe(l.copies_count, "—"),
            })

    not_used = [{"number": 1, "citation": "Не используется", "copies_count": "—"}]

    # ── ПО / БД / МТО ──────────────────────────────────────────────────────
    # «Вид ПО» в шаблоне = назначение (Операционные системы, Офисные приложения, …);
    # «Наименование ПО» = название с типом лицензии в скобках, как в эталонном РПД ПНИПУ.
    software = []
    for s in (rpd.software or []):
        name = (s.name or "").strip()
        license_ = (s.license_type or "").strip()
        full_name = f"{name} ({license_})" if license_ else (name or "—")
        software.append({
            "soft_type": _safe(s.purpose, "—"),
            "name": full_name,
        })
    if not software:
        software = [{"soft_type": "Не используется", "name": "—"}]

    # Сначала берём из БД (что заполнил преподаватель). Если ничего нет — fallback
    # на стандартный перечень ПНИПУ, чтобы шаблон не остался пустым.
    if rpd.databases:
        databases = [
            {"db_type": _safe(d.name, "—"), "url": _safe(d.url, "—")}
            for d in rpd.databases
        ]
    else:
        databases = [
            {"db_type": "База данных Elsevier «Freedom Collection»",
             "url": "https://www.elsevier.com/"},
            {"db_type": "База данных Springer Nature e-books",
             "url": "http://link.springer.com/"},
            {"db_type": "База данных научной электронной библиотеки (eLIBRARY.RU)",
             "url": "https://elibrary.ru/"},
            {"db_type": "Научная библиотека Пермского национального исследовательского политехнического университета",
             "url": "https://elib.pstu.ru/"},
            {"db_type": "Электронно-библиотечная система «Лань»",
             "url": "https://e.lanbook.com/"},
            {"db_type": "Электронно-библиотечная система IPRsmart",
             "url": "http://www.iprbookshop.ru/"},
            {"db_type": "Информационные ресурсы Сети КонсультантПлюс",
             "url": "локальная сеть"},
            {"db_type": "Информационно-справочная система нормативно-технической документации «Техэксперт: нормы, правила, стандарты и законодательства России»",
             "url": "http://325290.inkip.ru/docs"},
        ]

    material_tech = [
        {
            "lesson_type": _safe(m.room_type, "—"),
            "equipment": _safe(m.equipment, "—"),
            "quantity": _safe(m.quantity, "—"),
        }
        for m in (rpd.material_tech or [])
    ]
    if not material_tech:
        material_tech = [{"lesson_type": "Не используется", "equipment": "—", "quantity": "—"}]

    # ── Контекст ───────────────────────────────────────────────────────────
    context: dict[str, Any] = {
        "rector_position": "Проректор по образовательной деятельности",
        "rector_name": "И.Ю.Черникова",
        "discipline_name": d.name or "—",
        "study_form": "очная",
        "level_higher_education": (direction.degree_level if direction else None) or "бакалавриат",
        "total_hours": total_hours,
        "total_ze": _ze(total_hours),
        "direction_code": (direction.code if direction else None) or "—",
        "direction_name": (direction.name if direction else None) or "—",
        # Профиль шапки печатной формы — приоритетно из БУПа (он точнее), fallback на профиль направления.
        "program_name": bup_profile or (direction.profile if direction else None) or (direction.name if direction else None) or "—",
        "publish_year": (rpd.academic_year or str(datetime.now().year))[:4],

        "goals_text": _safe(rpd.goals_text, "—"),
        "objects_text": _safe(rpd.objects_text, "—"),
        "requirements_text": _safe(rpd.requirements_text, "Не предусмотрено"),

        "learning_outcomes": learning_outcomes,
        "workload": workload,
        "discipline_semesters": discipline_semesters,
        "total": total,

        "practical_topics": practical_topics,
        "lab_topics": lab_topics_list,

        "educational_tech": _safe(rpd.educational_tech, "—"),
        "methodical_recommendations": _safe(rpd.methodical_recommendations, "—"),

        "literature_main": lit_main or not_used,
        "literature_additional_study": lit_extra or not_used,
        "literature_periodical": not_used,
        "literature_additional_normative": not_used,
        "literature_methodical": not_used,
        "literature_self_study": not_used,
        "el_literature": lit_el or [{
            "els_type": "Не используется", "title": "—",
            "url": "—", "access": "—",
        }],

        "databases": databases,
        "software": software,
        "material_tech": material_tech,
    }

    return context
