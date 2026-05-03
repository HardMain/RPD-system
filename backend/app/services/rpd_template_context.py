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


def _blank_or_int(v):
    """Превратить значение часов в формат, готовый к рендеру в DOCX:
    None и 0 (если пришли как None) → пустая строка; целые → int.
    Жизнь-блок раздела 3 в шаблоне рисует ровно то, что мы кладём — `0` иногда
    нужен, поэтому различаем None (пусто) и 0 (явный ноль)."""
    if v is None:
        return ""
    return v


def _sum_or_blank(values):
    """Сумма чисел из values, игнорируя None. Если все None — возвращаем None."""
    nums = [v for v in values if isinstance(v, int)]
    if not nums:
        return None
    return sum(nums)


_CONTROL_LABEL_NORM = {
    "экзамен": "экзамен",
    "диф. зачет": "диф. зачет",
    "диф.зачет": "диф. зачет",
    "дифференцированный зачёт": "диф. зачет",
    "дифференцированный зачет": "диф. зачет",
    "зачёт": "зачёт",
    "зачет": "зачёт",
    "курсовой проект": "курсовой проект",
    "курсовая работа": "курсовая работа",
}


def _parse_control_form(raw: str) -> dict[int, set[str]]:
    """Парсим строку «Экзамен (3), Зачёт (2), Курсовая работа (3)» в map
    {3: {'экзамен', 'курсовая работа'}, 2: {'зачёт'}}. Это нужно для строки
    «Промежуточная аттестация» в разделе 3 печатной формы — у каждого семестра
    своя пометка (часы экзамена 9 ч, зачёт/курсовая просто '+')."""
    if not raw:
        return {}
    import re as _re
    out: dict[int, set[str]] = {}
    # Каждое срабатывание: «Метка (1, 2)» или «Метка (3)».
    for m in _re.finditer(r"([А-Яа-яёЁ\.\s]+?)\s*\(\s*([\d,\s]+)\s*\)", raw):
        label_raw = m.group(1).strip().lower()
        label = _CONTROL_LABEL_NORM.get(label_raw, label_raw)
        for tok in m.group(2).replace(",", " ").split():
            if tok.isdigit():
                out.setdefault(int(tok), set()).add(label)
    return out


# ─────────────────────────────────────────────────────────────────────────────


def build_context(rpd, bd=None, link=None) -> dict:
    """rpd — объект ORM Rpd с подгруженными связями. Возвращает dict под docxtpl.

    `link` — конкретная RpdBupDiscipline-привязка, для которой формируется
    печатная форма. У линка есть snapshot всех значимых полей плана (часы,
    направление, профиль, ФГОС), который заполняется при привязке и переживает
    hard-delete БУПа. Если линк передан — приоритет у snapshot. `bd` оставлен
    для обратной совместимости. Если не передано ничего — берём первый
    привязанный link («представительный»)."""
    d = rpd.discipline
    if link is None:
        link = next((l for l in (rpd.bup_links or [])), None)
    if bd is None and link is not None:
        bd = link.bup_discipline  # может быть None после hard-delete БУПа

    def _pick(snap, live):
        return snap if snap not in (None, "") else live

    direction = bd.bup.direction if bd and bd.bup else None
    direction_code = _pick(link.direction_code if link else None, direction.code if direction else None)
    direction_name = _pick(link.direction_name if link else None, direction.name if direction else None)
    direction_profile = _pick(link.direction_profile if link else None, direction.profile if direction else None)
    bup_profile = _pick(link.bup_profile if link else None, bd.bup.profile if bd and bd.bup else None)

    # Раздел 2 в печатной форме строится так же, как таблица в OutcomesEditor
    # (см. router rpd.get_outcomes_table): идём по живым индикаторам компетенций
    # выбранной БУП-привязки и для каждого подкладываем outcome_text/средство
    # оценки из rpd.learning_outcomes (если есть). Так строки с заполненными
    # снапшотами (competency_code/indicator_code/indicator_description) попадают
    # в PDF, даже если пользователь ещё не ввёл текст результата.
    if bd is not None:
        bds_for_indicators = [bd]
    else:
        bds_for_indicators = [
            link.bup_discipline for link in (rpd.bup_links or [])
            if link.bup_discipline is not None
        ]

    total_hours = _safe(_pick(link.total_hours if link else None, bd.total_hours if bd else 0), 0)
    lec = _safe(_pick(link.lecture_hours if link else None, bd.lecture_hours if bd else 0), 0)
    pr = _safe(_pick(link.practice_hours if link else None, bd.practice_hours if bd else 0), 0)
    lab = _safe(_pick(link.lab_hours if link else None, bd.lab_hours if bd else 0), 0)
    srs = _safe(_pick(link.self_study_hours if link else None, bd.self_study_hours if bd else 0), 0)
    contact = lec + pr + lab

    # Контрольная форма: какой семестр чем сдаётся. Парсим строку вида
    # «Экзамен (3), Зачёт (2), Курсовая работа (3)» в map {sem -> set(меток)}.
    control_str = _pick(link.control_form if link else None, bd.control_form if bd else "") or ""
    control_map = _parse_control_form(control_str)

    # ── Workload: один блок на каждый занятый семестр дисциплины ──────────
    # Источник — semesters_data (snapshot или живой BupDiscipline). Если он
    # пустой (БУП старого формата без per-semester полей) — собираем один
    # семестр из агрегатов, как раньше.
    sems_data = _pick(link.semesters_data if link else None, bd.semesters_data if bd else None)
    if not sems_data:
        sem_num = _parse_semester(_pick(link.semester if link else None, bd.semester if bd else None))
        sems_data = [{
            "number": sem_num,
            "lecture": lec, "lab": lab, "practice": pr, "ksr": None, "srs": srs,
        }]

    workload_semesters = []
    for s in sems_data:
        sn = s.get("number")
        s_lec = s.get("lecture")
        s_lab = s.get("lab")
        s_pr = s.get("practice")
        s_ksr = s.get("ksr")
        s_srs = s.get("srs")
        s_contact_parts = [v for v in (s_lec, s_lab, s_pr) if v]
        s_contact = sum(s_contact_parts) if s_contact_parts else None
        labels = control_map.get(sn, set())
        workload_semesters.append({
            "number": sn,
            "contact": _blank_or_int(s_contact),
            "lectures": _blank_or_int(s_lec),
            "labs": _blank_or_int(s_lab),
            "practice": _blank_or_int(s_pr),
            "ksr": _blank_or_int(s_ksr),
            "control_work": "",
            "srs": _blank_or_int(s_srs),
            "exam": 9 if "экзамен" in labels else "",
            "diff_credit": "" if "диф. зачет" not in labels else "+",
            "credit": "" if "зачёт" not in labels else "+",
            "course_project": "" if "курсовой проект" not in labels else "+",
            "course_work": "" if "курсовая работа" not in labels else "+",
            "total": _blank_or_int(_sum_or_blank([s_lec, s_lab, s_pr, s_ksr, s_srs])),
        })

    # «Итого» по всем семестрам — сумма по числовым ячейкам, пустые игнорируем.
    def _col_sum(key):
        total = 0
        any_value = False
        for s in workload_semesters:
            v = s.get(key)
            if isinstance(v, int):
                total += v
                any_value = True
        return total if any_value else ""
    total_block = {
        "number": "Итого",
        "contact": _col_sum("contact"),
        "lectures": _col_sum("lectures"),
        "labs": _col_sum("labs"),
        "practice": _col_sum("practice"),
        "ksr": _col_sum("ksr"),
        "control_work": _col_sum("control_work"),
        "srs": _col_sum("srs"),
        "exam": _col_sum("exam"),
        "diff_credit": _col_sum("diff_credit"),
        "credit": _col_sum("credit"),
        "course_project": _col_sum("course_project"),
        "course_work": _col_sum("course_work"),
        "total": total_hours,
    }
    workload = {
        "total": total_block,
        "semesters": workload_semesters,
    }

    # ── Результаты обучения ────────────────────────────────────────────────
    # Источник истины — RpdLearningOutcome (как и в /outcomes-table).
    # snapshot competency_code/indicator_code/indicator_description заполняется
    # при autofill во время создания РПД и сохраняется даже после удаления БУПа.
    # Дедуп — по живому id_indicator, иначе по snapshot-ключу.
    learning_outcomes = []
    seen_keys: set[tuple] = set()
    for lo in (rpd.learning_outcomes or []):
        ind = lo.indicator if lo.id_indicator is not None else None
        comp = ind.competency if ind else None
        if lo.id_indicator is not None:
            key = ("ind", lo.id_indicator)
        else:
            key = ("snap", lo.competency_code or "", lo.indicator_code or "")
        if key in seen_keys:
            continue
        # Пустые snapshot-строки (без competency/indicator кода) пропускаем —
        # это «битые» данные, в печатную форму они не попадают.
        comp_code = lo.competency_code or (comp.code if comp else "") or ""
        ind_code = lo.indicator_code or (ind.code if ind else "") or ""
        if not comp_code and not ind_code:
            continue
        seen_keys.add(key)
        learning_outcomes.append({
            "competency_code": comp_code,
            "indicator_code": ind_code,
            "outcome_text": lo.outcome_text or "",
            "indicator_description": lo.indicator_description or (ind.description if ind else "") or "",
            "assessment_tool": lo.assessment_tool or "",
        })

    # Сортируем по коду компетенции и индикатора — стабильный порядок и тот же,
    # что у OutcomesEditor.
    learning_outcomes.sort(key=lambda r: (r["competency_code"], r["indicator_code"]))

    # ── Содержание дисциплины (разделы по семестрам) ──────────────────────
    # Разделы без названия пропускаем: пользователь добавил пустую строку и не
    # успел/не стал её заполнить — в печатной форме её быть не должно. Это же
    # правило фильтрует темы 4.1/4.2 (frontend TopicsEditor делает то же).
    rpd_sections = [s for s in (rpd.sections or []) if (s.title or "").strip()]
    # Группируем разделы по семестрам, в которые их положил пользователь. Если
    # у дисциплины один семестр — все разделы попадают в него (даже если
    # section.semester is None — старые данные). Если несколько — разделы без
    # явно указанного семестра привязываем к первому.
    plan_semester_numbers = [s["number"] for s in workload_semesters if s["number"] is not None]
    if not plan_semester_numbers:
        plan_semester_numbers = [_parse_semester(_pick(link.semester if link else None, bd.semester if bd else None))]
    fallback_sem = plan_semester_numbers[0]

    by_sem: dict[int, list] = {n: [] for n in plan_semester_numbers}
    tot_lec = tot_lab = tot_pr = tot_srs = 0
    for s in rpd_sections:
        sl = _safe(s.lecture_hours, 0)
        sp = _safe(s.practice_hours, 0)
        slb = _safe(s.lab_hours, 0)
        ss = _safe(s.self_study_hours, 0)
        tot_lec += sl
        tot_pr += sp
        tot_lab += slb
        tot_srs += ss
        sec_sem = s.semester if s.semester in by_sem else fallback_sem
        by_sem.setdefault(sec_sem, []).append({
            "name": s.title,
            "description": _safe(s.brief_content, ""),
            "lectures": sl,
            "labs": slb,
            "practice": sp,
            "srs": ss,
        })

    discipline_semesters = []
    for n in sorted(by_sem.keys()):
        items = by_sem[n]
        discipline_semesters.append({
            "number": n,
            "sections": items,
            "total_lectures": sum(it["lectures"] for it in items),
            "total_labs": sum(it["labs"] for it in items),
            "total_practice": sum(it["practice"] for it in items),
            "total_srs": sum(it["srs"] for it in items),
        })
    total = {
        "lectures": tot_lec,
        "labs": tot_lab,
        "practice": tot_pr,
        "srs": tot_srs,
    }

    # ── Темы лабораторных и практических ──────────────────────────────────
    # Источник тем — те же отфильтрованные «осмысленные» разделы.
    lab_topics, prac_topics = [], []
    for s in rpd_sections:
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
    # На фронте источник литературы выбирается из фиксированного списка видов
    # (см. frontend/src/features/rpd-editor/literatureTypes.js). По нему
    # раскладываем записи по 5 группам печатных + одна группа электронных.
    # Старые legacy-поля (authors/year/publisher) остались только для уже
    # сохранённых до миграции РПД — при формировании ссылки они подмешиваются,
    # если есть.
    def _mk_citation(l) -> str:
        parts = []
        if getattr(l, "authors", None):
            parts.append(l.authors)
        if (l.title or "").strip():
            parts.append(l.title)
        if not parts:
            # Пользователь заполнил какое-то поле строки (например, copies_count
            # или вид ЭБС), но title не ввёл — в ячейке цитирования просто пусто,
            # а не «—.» как раньше.
            return ""
        ref = " ".join(parts)
        tail = []
        if getattr(l, "publisher", None):
            tail.append(l.publisher)
        if getattr(l, "year", None):
            tail.append(str(l.year))
        if tail:
            ref += " — " + ", ".join(tail)
        return ref.rstrip(".") + "."

    PRINTED_BUCKETS = {
        "Учебные и научные издания": "main",
        # Подгруппа 2.1 «Учебные и научные издания» из раздела
        # «Дополнительная литература» — отдельный source_type, чтобы записи
        # 1 «Основной» и 2.1 «Дополнительной» не смешивались.
        "Учебные и научные издания (дополнительные)": "additional_study",
        "Периодические издания": "periodical",
        "Нормативно-технические издания": "normative",
        "Методические указания для студентов по освоению дисциплины": "methodical",
        "Учебно-методическое обеспечение самостоятельной работы студента": "self_study",
    }
    buckets = {k: [] for k in ("main", "additional_study", "periodical", "normative", "methodical", "self_study")}
    lit_el = []
    # Дискриминатор «электронная» — наличие URL (truthy). Согласовано с
    # frontend/LiteratureEditor: новой строке 6.2 он кладёт URL=" " (sentinel),
    # чтобы запись не «утекала» в 6.1 до ввода настоящей ссылки. После .strip()
    # этот пробел становится пустым — значит «реальной ссылки нет» в фильтре.
    #
    # Правило фильтра: строка попадает в печатную форму, если ХОТЯ БЫ ОДНО поле
    # заполнено пользователем. Для 6.1 source_type выставляется автоматически
    # по группе («+ Добавить запись» в «Основной литературе» сразу пишет тип) —
    # значит сам по себе не считается «пользовательским заполнением». Для 6.2
    # источник литературы пользователь выбирает в выпадашке вручную, и любая
    # выбранная позиция уже делает строку «непустой».
    for l in (rpd.literature or []):
        if l.url:  # электронная (включая sentinel " ")
            url_clean = (l.url or "").strip()
            type_clean = (l.source_type or "").strip()
            title_clean = (l.title or "").strip()
            avail = l.availability or []
            if not (title_clean or url_clean or type_clean or avail):
                continue
            access = ", ".join(avail) if avail else ""
            lit_el.append({
                "els_type": type_clean,
                "title": _mk_citation(l),
                "url": url_clean,
                "access": access,
            })
            continue
        # 6.1 печатная — source_type сам по себе пустоту не отменяет (его выбрал
        # не пользователь, а кнопка «+» в группе).
        if not (l.title or "").strip() and l.copies_count is None:
            continue
        bucket = PRINTED_BUCKETS.get((l.source_type or "").strip())
        if not bucket:
            # Неизвестный/legacy-вид без url трактуем как «учебные и научные».
            bucket = "main"
        buckets[bucket].append({
            "number": len(buckets[bucket]) + 1,
            "citation": _mk_citation(l),
            "copies_count": "" if l.copies_count is None else l.copies_count,
        })

    # Шаблон 6.1 имеет встроенную ветку:
    #   {%tr if lo.citation == 'Не используется' %} {{lo.citation}} {%tr else %} ...
    # «Не используется» — это фраза ИЗ ШАБЛОНА, нам надо просто отдать тот ровно
    # этот sentinel в citation, чтобы шаблон сам нарисовал свою компактную строку.
    empty_printed = [{"number": "", "citation": "Не используется", "copies_count": ""}]

    # ── ПО / БД / МТО ──────────────────────────────────────────────────────
    # Правило для всех трёх таблиц: строка попадает в печатную форму, если
    # пользователь ввёл/выбрал ХОТЯ БЫ одно поле. Все поля пустые → пропускаем.
    software = []
    for s in (rpd.software or []):
        soft_type = (s.license_type or "").strip()
        name = (s.name or "").strip()
        if not soft_type and not name:
            continue
        software.append({"soft_type": soft_type, "name": name})
    if not software:
        software = [{"soft_type": "", "name": ""}]

    # «Вид БД» = db_type; «Наименование БД» = name (шаблонный ключ называется
    # `url` исторически — переиспользуется под наименование). Пустые строки
    # пропускаем; стандартный перечень ПНИПУ больше НЕ подставляется по
    # умолчанию (это была активная подстановка, которой в АРМ нет; пользователь
    # хотел убрать — теперь пусто = одна пустая строка).
    # ВАЖНО: цикл-переменная — `db`, не `d`. Имя `d` уже занято объектом
    # дисциплины (см. `d = rpd.discipline` выше) и используется ниже в контексте
    # `discipline_name=d.name`. Раньше тут было `for d in ...`, и d затирался —
    # из-за чего на печатной форме имя дисциплины подменялось именем последней БД
    # (или вовсе пустотой, если БД пользователь не добавлял).
    databases = []
    for db in (rpd.databases or []):
        db_type = (db.db_type or "").strip()
        name = (db.name or "").strip()
        if not db_type and not name:
            continue
        databases.append({"db_type": db_type, "url": name})
    if not databases:
        databases = [{"db_type": "", "url": ""}]

    material_tech = []
    for m in (rpd.material_tech or []):
        # «Пусто» для МТО — нет ни вида занятий, ни оборудования, ни количества.
        if not (m.room_type or "").strip() and not (m.equipment or "").strip() and m.quantity is None:
            continue
        material_tech.append({
            "lesson_type": (m.room_type or "").strip(),
            "equipment": (m.equipment or "").strip(),
            "quantity": "" if m.quantity is None else m.quantity,
        })
    if not material_tech:
        material_tech = [{"lesson_type": "", "equipment": "", "quantity": ""}]

    # ── Контекст ───────────────────────────────────────────────────────────
    context: dict[str, Any] = {
        "rector_position": "Проректор по образовательной деятельности",
        "rector_name": "И.Ю.Черникова",
        "discipline_name": d.name or "—",
        "study_form": "очная",
        "level_higher_education": (direction.degree_level if direction else None) or "бакалавриат",
        "total_hours": total_hours,
        "total_ze": _ze(total_hours),
        "direction_code": (direction_code or (direction.code if direction else None)) or "—",
        "direction_name": (direction_name or (direction.name if direction else None)) or "—",
        # Профиль шапки печатной формы — приоритетно из БУПа (он точнее), fallback на профиль направления.
        "program_name": bup_profile or direction_profile or (direction.profile if direction else None) or direction_name or "—",
        "publish_year": (rpd.academic_year or str(datetime.now().year))[:4],

        # Незаполненные текстовые блоки шаблон должен рендерить как ПУСТУЮ
        # строку, а не «—». Прочерки сбивают читателя: в Word'е такие места
        # должны просто оставаться чистыми — преподаватель допишет позже.
        "goals_text": _safe(rpd.goals_text, ""),
        "objects_text": _safe(rpd.objects_text, ""),
        "requirements_text": _safe(rpd.requirements_text, ""),

        "learning_outcomes": learning_outcomes,
        "workload": workload,
        "discipline_semesters": discipline_semesters,
        "total": total,

        "practical_topics": practical_topics,
        "lab_topics": lab_topics_list,

        "educational_tech": _safe(rpd.educational_tech, ""),
        "methodical_recommendations": _safe(rpd.methodical_recommendations, ""),

        "literature_main": buckets["main"] or empty_printed,
        # Подгруппа 2.1 — теперь у фронта своя категория («Учебные и научные
        # издания (дополнительные)»), бакетится в `additional_study`. Если в
        # подгруппе нет записей, в шаблон уходит «Не используется» — точно так
        # же, как и у других пустых разделов 6.1.
        "literature_additional_study": buckets["additional_study"] or empty_printed,
        "literature_periodical": buckets["periodical"] or empty_printed,
        "literature_additional_normative": buckets["normative"] or empty_printed,
        "literature_methodical": buckets["methodical"] or empty_printed,
        "literature_self_study": buckets["self_study"] or empty_printed,
        "el_literature": lit_el or [{
            "els_type": "", "title": "", "url": "", "access": "",
        }],

        "databases": databases,
        "software": software,
        "material_tech": material_tech,
    }

    return context
