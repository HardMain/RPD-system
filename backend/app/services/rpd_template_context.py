from __future__ import annotations

from datetime import datetime
from typing import Any

def split_paragraphs(text: Any) -> list[str]:
    if not text:
        return [""]
    out = [raw.strip() for raw in str(text).splitlines()]
    while out and out[0] == "":
        out.pop(0)
    while out and out[-1] == "":
        out.pop()
    return out or [""]

def _safe(value: Any, default: Any = "") -> Any:
    if value is None:
        return default
    return value

def _ze(hours: int | None) -> int:
    if not hours:
        return 0
    return round(hours / 36)

def _parse_semester(raw: Any) -> int:
    if raw is None:
        return 1
    s = str(raw).strip()
    for token in s.replace(",", "-").split("-"):
        token = token.strip()
        if token.isdigit():
            return int(token)
    return 1

def _blank_or_int(v):
    if v is None:
        return ""
    return v

def _sum_or_blank(values):
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
    if not raw:
        return {}
    import re as _re
    out: dict[int, set[str]] = {}
    for m in _re.finditer(r"([А-Яа-яёЁ\.\s]+?)\s*\(\s*([\d,\s]+)\s*\)", raw):
        label_raw = m.group(1).strip().lower()
        label = _CONTROL_LABEL_NORM.get(label_raw, label_raw)
        for tok in m.group(2).replace(",", " ").split():
            if tok.isdigit():
                out.setdefault(int(tok), set()).add(label)
    return out

def build_context(rpd, bd=None, link=None, approver=None) -> dict:
    d = rpd.discipline
    if link is None:
        link = next((l for l in (rpd.bup_links or [])), None)
    if bd is None and link is not None:
        bd = link.bup_discipline

    def _pick(snap, live):
        return snap if snap not in (None, "") else live

    direction = bd.bup.direction if bd and bd.bup else None
    direction_code = _pick(link.direction_code if link else None, direction.code if direction else None)
    direction_name = _pick(link.direction_name if link else None, direction.name if direction else None)
    direction_profile = _pick(link.direction_profile if link else None, direction.profile if direction else None)
    bup_profile = _pick(link.bup_profile if link else None, bd.bup.profile if bd and bd.bup else None)
    study_form = _pick(link.form_of_study if link else None, bd.bup.form_of_study if bd and bd.bup else None) or ""

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
    ksr = _safe(_pick(link.ksr_hours if link else None, bd.ksr_hours if bd else 0), 0)
    srs = _safe(_pick(link.self_study_hours if link else None, bd.self_study_hours if bd else 0), 0)
    exam_total = _safe(_pick(link.exam_hours if link else None, bd.exam_hours if bd else 0), 0)
    contact = lec + pr + lab + ksr

    control_str = _pick(link.control_form if link else None, bd.control_form if bd else "") or ""
    control_map = _parse_control_form(control_str)

    exam_semesters_count = sum(1 for labels in control_map.values() if "экзамен" in labels)
    if exam_semesters_count > 0 and exam_total:
        exam_per_semester = round(exam_total / exam_semesters_count) or 36
    else:
        exam_per_semester = 36

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
        s_contact_parts = [v for v in (s_lec, s_lab, s_pr, s_ksr) if isinstance(v, int)]
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
            "exam": exam_per_semester if "экзамен" in labels else "",
            "diff_credit": "" if "диф. зачет" not in labels else "+",
            "credit": "" if "зачёт" not in labels else "+",
            "course_project": "" if "курсовой проект" not in labels else "+",
            "course_work": "" if "курсовая работа" not in labels else "+",
            "total": _blank_or_int(_sum_or_blank([s_lec, s_lab, s_pr, s_ksr, s_srs])),
        })

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

    def _bd_indicator_ids(bdisc) -> set[int]:
        out: set[int] = set()
        for bdc in (bdisc.competencies or []):
            comp = bdc.competency
            if comp:
                for ci in (comp.indicators or []):
                    out.add(ci.id_indicator)
        return out

    bound_links = list(rpd.bup_links or [])
    bound_bds = [l.bup_discipline for l in bound_links if l.bup_discipline is not None]

    selected_link_id: int | None = None
    if bd is not None and len(bound_links) > 1:
        selected_link_id = next(
            (l.id_rpd_bup_discipline for l in bound_links
             if l.bup_discipline is not None and l.bup_discipline.id_bup_discipline == bd.id_bup_discipline),
            None,
        )

    selected_inds: set[int] | None = None
    all_bound_inds: set[int] = set()
    if bd is not None and len(bound_bds) > 1:
        selected_inds = _bd_indicator_ids(bd)
        for b in bound_bds:
            all_bound_inds |= _bd_indicator_ids(b)

    def _lo_visible(lo) -> bool:
        if selected_link_id is not None:
            if lo.id_rpd_bup_discipline == selected_link_id:
                return True
            if lo.id_rpd_bup_discipline is None and (lo.id_indicator is None or lo.id_indicator not in all_bound_inds):
                return True
            return False
        if selected_inds is None:
            return True
        if lo.id_indicator is None:
            return True
        if lo.id_indicator in selected_inds:
            return True
        return lo.id_indicator not in all_bound_inds

    learning_outcomes = []
    seen_keys: set[tuple] = set()
    for lo in (rpd.learning_outcomes or []):
        if not _lo_visible(lo):
            continue
        ind = lo.indicator if lo.id_indicator is not None else None
        comp = ind.competency if ind else None
        if lo.id_indicator is not None:
            key = ("ind", lo.id_rpd_bup_discipline, lo.id_indicator)
        else:
            key = ("snap", lo.id_rpd_bup_discipline, lo.competency_code or "", lo.indicator_code or "")
        if key in seen_keys:
            continue
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

    learning_outcomes.sort(key=lambda r: (r["competency_code"], r["indicator_code"]))

    rpd_sections = [s for s in (rpd.sections or []) if (s.title or "").strip()]
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

    lab_topics, prac_topics = [], []
    for t in (getattr(rpd, "topics", None) or []):
        title = (t.title or "").strip()
        if not title:
            continue
        tt = (t.topic_type or "").lower()
        if tt in ("lab", "лр", "лаб", "laboratory"):
            lab_topics.append(title)
        elif tt in ("practice", "пз", "практика", "seminar"):
            prac_topics.append(title)

    practical_topics = [
        {"index": i, "title": t} for i, t in enumerate(prac_topics, 1)
    ]
    lab_topics_list = [
        {"index": i, "title": t} for i, t in enumerate(lab_topics, 1)
    ]

    def _mk_citation(l) -> str:
        parts = []
        if getattr(l, "authors", None):
            parts.append(l.authors)
        if (l.title or "").strip():
            parts.append(l.title)
        if not parts:
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
        "Учебные и научные издания (дополнительные)": "additional_study",
        "Периодические издания": "periodical",
        "Нормативно-технические издания": "normative",
        "Методические указания для студентов по освоению дисциплины": "methodical",
        "Учебно-методическое обеспечение самостоятельной работы студента": "self_study",
    }
    buckets = {k: [] for k in ("main", "additional_study", "periodical", "normative", "methodical", "self_study")}
    lit_el = []
    for l in (rpd.literature or []):
        if l.url:
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
        if not (l.title or "").strip() and l.copies_count is None:
            continue
        bucket = PRINTED_BUCKETS.get((l.source_type or "").strip())
        if not bucket:
            bucket = "main"
        buckets[bucket].append({
            "number": len(buckets[bucket]) + 1,
            "citation": _mk_citation(l),
            "copies_count": "" if l.copies_count is None else l.copies_count,
        })

    empty_printed = [{"number": "", "citation": "Не используется", "copies_count": ""}]

    software = []
    for s in (rpd.software or []):
        soft_type = (s.license_type or "").strip()
        name = (s.name or "").strip()
        if not soft_type and not name:
            continue
        software.append({"soft_type": soft_type, "name": name})
    if not software:
        software = [{"soft_type": "", "name": ""}]

    databases = []
    for db in (rpd.databases or []):
        name = (db.name or "").strip()
        url = (db.url or "").strip()
        if not name and not url:
            continue
        databases.append({"db_type": name, "url": url})
    if not databases:
        databases = [{"db_type": "", "url": ""}]

    material_tech = []
    for m in (rpd.material_tech or []):
        if not (m.room_type or "").strip() and not (m.equipment or "").strip() and m.quantity is None:
            continue
        material_tech.append({
            "lesson_type": (m.room_type or "").strip(),
            "equipment": (m.equipment or "").strip(),
            "quantity": "" if m.quantity is None else m.quantity,
        })
    if not material_tech:
        material_tech = [{"lesson_type": "", "equipment": "", "quantity": ""}]

    context: dict[str, Any] = {
        "rector_position": (approver or {}).get("position") or "Проректор по образовательной деятельности",
        "rector_name": (approver or {}).get("name") or "И.Ю.Черникова",
        "discipline_name": d.name or "",
        "study_form": study_form,
        "level_higher_education": _pick(link.degree_level if link else None, direction.degree_level if direction else None) or "бакалавриат",
        "total_hours": total_hours,
        "total_ze": _ze(total_hours),
        "direction_code": (direction_code or (direction.code if direction else None)) or "",
        "direction_name": (direction_name or (direction.name if direction else None)) or "",
        "program_name": bup_profile or direction_profile or (direction.profile if direction else None) or direction_name or "",
        "publish_year": (rpd.academic_year or str(datetime.now().year))[:4],

        "goals_text": split_paragraphs(_safe(rpd.goals_text, "")),
        "objects_text": split_paragraphs(_safe(rpd.objects_text, "")),
        "requirements_text": split_paragraphs(_safe(rpd.requirements_text, "")),

        "learning_outcomes": learning_outcomes,
        "workload": workload,
        "discipline_semesters": discipline_semesters,
        "total": total,

        "practical_topics": practical_topics,
        "lab_topics": lab_topics_list,

        "educational_tech": split_paragraphs(_safe(rpd.educational_tech, "")),
        "methodical_recommendations": split_paragraphs(_safe(rpd.methodical_recommendations, "")),

        "literature_main": buckets["main"] or empty_printed,
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
