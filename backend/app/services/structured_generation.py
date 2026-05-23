import json
import re
from collections import defaultdict

from sqlalchemy import select, delete, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Rpd, RpdSection, RpdTopic, RpdLiterature, RpdSoftware, RpdMaterialTech,
    RpdDatabase, RpdLearningOutcome, RpdBupDiscipline, CompetencyIndicator,
    Competency, BupDisciplineCompetency,
)


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.+?)\s*```", re.DOTALL | re.IGNORECASE)


def parse_json_array(text: str) -> list[dict] | None:
    if not text:
        return None
    candidate = text.strip()
    fence = _JSON_FENCE_RE.search(candidate)
    if fence:
        candidate = fence.group(1).strip()
    start = candidate.find("[")
    end = candidate.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return None
    candidate = candidate[start:end + 1]
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, list):
        return None
    return [it for it in data if isinstance(it, dict)]


def _is_section_empty(section: RpdSection) -> bool:
    return (
        not (section.title or "").strip()
        and not (section.brief_content or "").strip()
        and not section.lecture_hours
        and not section.practice_hours
        and not section.lab_hours
        and not section.self_study_hours
    )


def _coerce_int(value, default=0) -> int:
    try:
        if value is None or value == "":
            return default
        return int(value)
    except (TypeError, ValueError):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return default


async def _primary_semester(db: AsyncSession, rpd_id: int) -> int | None:
    res = await db.execute(
        select(RpdBupDiscipline).where(RpdBupDiscipline.id_rpd == rpd_id)
    )
    links = res.scalars().all()
    semesters: set[int] = set()
    for link in links:
        data = link.semesters_data or []
        for entry in data:
            num = entry.get("number") if isinstance(entry, dict) else None
            if isinstance(num, int):
                semesters.add(num)
        if not semesters and link.semester:
            m = re.search(r"\d+", link.semester)
            if m:
                semesters.add(int(m.group(0)))
    if not semesters:
        return None
    return min(semesters)


def _scale_field(group: list[dict], field: str, target: int) -> None:
    if target == 0:
        for item in group:
            item[field] = 0
        return
    current = sum(_coerce_int(item.get(field)) for item in group)
    if current == 0 or current == target:
        return
    scaled = [int(_coerce_int(item.get(field)) * target / current) for item in group]
    remainder = target - sum(scaled)
    order = sorted(range(len(group)), key=lambda i: -_coerce_int(group[i].get(field)))
    step = 1 if remainder > 0 else -1
    for i in range(abs(remainder)):
        scaled[order[i % len(order)]] += step
    for item, val in zip(group, scaled):
        item[field] = max(0, val)


def _normalize_section_hours(
    items: list[dict],
    semester_plan: dict[int, dict],
    total_lecture: int,
    total_practice: int,
    total_lab: int,
    total_srs: int,
) -> None:
    FIELD_PLAN_KEY = {
        "lecture_hours": "lecture",
        "practice_hours": "practice",
        "lab_hours": "lab",
        "self_study_hours": "srs",
    }
    FIELD_TOTAL = {
        "lecture_hours": total_lecture,
        "practice_hours": total_practice,
        "lab_hours": total_lab,
        "self_study_hours": total_srs,
    }
    if not semester_plan:
        for field, total in FIELD_TOTAL.items():
            _scale_field(items, field, total)
        return

    tagged: dict[int, list[dict]] = defaultdict(list)
    untagged: list[dict] = []
    for item in items:
        sem = _coerce_int(item.get("semester"), default=0)
        if sem in semester_plan:
            tagged[sem].append(item)
        else:
            untagged.append(item)

    if untagged and not tagged:
        if len(semester_plan) == 1:
            single_plan = next(iter(semester_plan.values()))
            for field, plan_key in FIELD_PLAN_KEY.items():
                _scale_field(untagged, field, single_plan.get(plan_key, 0) or 0)
        else:
            for field, total in FIELD_TOTAL.items():
                _scale_field(untagged, field, total)
        return

    for sem, group in tagged.items():
        plan = semester_plan[sem]
        for field, plan_key in FIELD_PLAN_KEY.items():
            _scale_field(group, field, plan.get(plan_key, 0) or 0)

    if untagged:
        for field, total in FIELD_TOTAL.items():
            _scale_field(untagged, field, total)


async def apply_content_sections(
    db: AsyncSession,
    rpd: Rpd,
    items: list[dict],
    semester_plan: dict[int, dict] | None = None,
    total_lecture: int = 0,
    total_practice: int = 0,
    total_lab: int = 0,
    total_srs: int = 0,
) -> int:
    if not items:
        return 0

    _normalize_section_hours(
        items,
        semester_plan or {},
        total_lecture, total_practice, total_lab, total_srs,
    )

    existing_res = await db.execute(
        select(RpdSection).where(RpdSection.id_rpd == rpd.id_rpd)
    )
    for s in existing_res.scalars().all():
        await db.delete(s)
    await db.flush()

    primary_sem = await _primary_semester(db, rpd.id_rpd)

    created = 0
    for offset, item in enumerate(items):
        title = (item.get("title") or "").strip()
        if not title:
            continue
        item_semester = _coerce_int(item.get("semester"), default=0) or primary_sem
        db.add(RpdSection(
            id_rpd=rpd.id_rpd,
            section_number=1 + offset,
            title=title[:300],
            brief_content=(item.get("brief_content") or "").strip() or None,
            lecture_hours=_coerce_int(item.get("lecture_hours")),
            practice_hours=_coerce_int(item.get("practice_hours")),
            lab_hours=_coerce_int(item.get("lab_hours")),
            self_study_hours=_coerce_int(item.get("self_study_hours")),
            semester=item_semester,
        ))
        created += 1
    if created:
        await db.commit()
    return created


async def apply_topics(db: AsyncSession, rpd_id: int, items: list[dict], topic_type: str) -> int:
    await db.execute(
        delete(RpdTopic)
        .where(RpdTopic.id_rpd == rpd_id)
        .where(RpdTopic.topic_type == topic_type)
    )
    created = 0
    for item in items:
        title = (item.get("title") or "").strip()
        if not title:
            continue
        db.add(RpdTopic(
            id_rpd=rpd_id,
            topic_type=topic_type,
            title=title[:500],
            hours=_coerce_int(item.get("hours")) or None,
            description=(item.get("description") or "").strip() or None,
        ))
        created += 1
    if created:
        await db.commit()
    return created


_PRINTED_SOURCE_TYPES: dict[str, str] = {
    "literature_printed_main": "Учебные и научные издания",
    "literature_printed_additional": "Учебные и научные издания (дополнительные)",
    "literature_periodicals": "Периодические издания",
    "literature_normative": "Нормативно-технические издания",
    "literature_methodical_students": "Методические указания для студентов по освоению дисциплины",
    "literature_methodical_self_study": "Учебно-методическое обеспечение самостоятельной работы студента",
}


async def apply_literature(db: AsyncSession, rpd_id: int, items: list[dict], section_key: str) -> int:
    source_type = _PRINTED_SOURCE_TYPES.get(section_key)
    if source_type:
        await db.execute(
            delete(RpdLiterature)
            .where(RpdLiterature.id_rpd == rpd_id)
            .where(RpdLiterature.source_type == source_type)
        )
    else:
        await db.execute(
            delete(RpdLiterature)
            .where(RpdLiterature.id_rpd == rpd_id)
            .where(RpdLiterature.url.isnot(None))
        )
    created = 0
    for item in items:
        title = (item.get("title") or "").strip()
        if not title:
            continue
        stype = source_type or (item.get("source_type") or "Электронный ресурс").strip()
        copies_raw = item.get("copies_count")
        year_raw = item.get("year")
        db.add(RpdLiterature(
            id_rpd=rpd_id,
            source_type=stype,
            title=title,
            copies_count=_coerce_int(copies_raw) if copies_raw is not None else None,
            url=(item.get("url") or "").strip() or None,
            availability=item.get("availability") or None,
            authors=(item.get("authors") or "").strip() or None,
            year=_coerce_int(year_raw) if year_raw is not None else None,
            publisher=(item.get("publisher") or "").strip() or None,
        ))
        created += 1
    if created:
        await db.commit()
    return created


async def apply_software(db: AsyncSession, rpd_id: int, items: list[dict]) -> int:
    await db.execute(delete(RpdSoftware).where(RpdSoftware.id_rpd == rpd_id))
    created = 0
    for item in items:
        name = (item.get("name") or "").strip()
        if not name:
            continue
        lic = (item.get("license_type") or "").strip()
        if lic.startswith("[") and lic.endswith("]"):
            lic = lic[1:-1].strip()
        db.add(RpdSoftware(
            id_rpd=rpd_id,
            name=name[:300],
            license_type=lic or None,
        ))
        created += 1
    if created:
        await db.commit()
    return created


async def apply_databases(db: AsyncSession, rpd_id: int, items: list[dict]) -> int:
    await db.execute(delete(RpdDatabase).where(RpdDatabase.id_rpd == rpd_id))
    created = 0
    for item in items:
        name = (item.get("name") or "").strip()
        if not name:
            continue
        db.add(RpdDatabase(
            id_rpd=rpd_id,
            name=name,
            db_type=(item.get("db_type") or "").strip() or None,
            url=(item.get("url") or "").strip() or None,
        ))
        created += 1
    if created:
        await db.commit()
    return created


async def apply_material_tech(db: AsyncSession, rpd_id: int, items: list[dict]) -> int:
    await db.execute(delete(RpdMaterialTech).where(RpdMaterialTech.id_rpd == rpd_id))
    created = 0
    for item in items:
        room_type = (item.get("room_type") or "").strip()
        if not room_type:
            continue
        qty_raw = item.get("quantity")
        db.add(RpdMaterialTech(
            id_rpd=rpd_id,
            room_type=room_type[:100],
            equipment=(item.get("equipment") or "").strip() or None,
            quantity=_coerce_int(qty_raw) if qty_raw is not None else None,
        ))
        created += 1
    if created:
        await db.commit()
    return created


async def apply_learning_outcomes(
    db: AsyncSession, rpd_id: int, items: list[dict],
    id_bup_discipline: int | None = None,
) -> int:
    items_by_code: dict[str, dict] = {}
    for it in items:
        code = (it.get("indicator_code") or "").strip()
        if code and code not in items_by_code:
            items_by_code[code] = it

    rpd_res = await db.execute(
        select(Rpd).where(Rpd.id_rpd == rpd_id)
        .options(selectinload(Rpd.bup_links))
    )
    rpd = rpd_res.scalar_one_or_none()
    if rpd is None:
        return 0

    bup_links_by_bd = {
        l.id_bup_discipline: l for l in (rpd.bup_links or [])
        if l.id_bup_discipline is not None and not getattr(l, "is_manual", False)
    }

    if bup_links_by_bd:
        if id_bup_discipline is not None and id_bup_discipline in bup_links_by_bd:
            scope_bd_ids = [id_bup_discipline]
        else:
            scope_bd_ids = list(bup_links_by_bd.keys())

        ind_res = await db.execute(
            select(CompetencyIndicator, BupDisciplineCompetency.id_bup_discipline)
            .join(Competency, Competency.id_competency == CompetencyIndicator.id_competency)
            .join(BupDisciplineCompetency, BupDisciplineCompetency.id_competency == Competency.id_competency)
            .where(BupDisciplineCompetency.id_bup_discipline.in_(scope_bd_ids))
            .options(selectinload(CompetencyIndicator.competency))
            .order_by(BupDisciplineCompetency.id_bup_discipline, Competency.code, CompetencyIndicator.code)
        )
        target: list[tuple[int, CompetencyIndicator]] = []
        seen: set[tuple[int, int]] = set()
        for ind, bd_id in ind_res.all():
            key = (bd_id, ind.id_indicator)
            if key in seen:
                continue
            seen.add(key)
            target.append((bd_id, ind))
        if not target:
            return 0

        if len(scope_bd_ids) == len(bup_links_by_bd):
            await db.execute(delete(RpdLearningOutcome).where(RpdLearningOutcome.id_rpd == rpd_id))
        else:
            scope_link_ids = [bup_links_by_bd[bd].id_rpd_bup_discipline for bd in scope_bd_ids]
            target_ind_ids = list({ind.id_indicator for _, ind in target})
            await db.execute(
                delete(RpdLearningOutcome)
                .where(RpdLearningOutcome.id_rpd == rpd_id)
                .where(
                    or_(
                        RpdLearningOutcome.id_rpd_bup_discipline.in_(scope_link_ids),
                        and_(
                            RpdLearningOutcome.id_rpd_bup_discipline.is_(None),
                            RpdLearningOutcome.id_indicator.in_(target_ind_ids),
                        ),
                    )
                )
            )
        await db.flush()

        for bd_id, ind in target:
            link = bup_links_by_bd[bd_id]
            it = items_by_code.get((ind.code or "").strip(), {})
            db.add(RpdLearningOutcome(
                id_rpd=rpd_id,
                id_rpd_bup_discipline=link.id_rpd_bup_discipline,
                id_indicator=ind.id_indicator,
                indicator_code=ind.code,
                indicator_description=(ind.description or None),
                competency_code=(ind.competency.code if ind.competency else None),
                competency_name=(ind.competency.name if ind.competency else None),
                outcome_text=(it.get("outcome_text") or "").strip() or None,
                assessment_tool=(it.get("assessment_tool") or "").strip() or None,
            ))
        await db.commit()
        return len(target)

    if not items_by_code:
        return 0

    resolved: list[tuple[dict, CompetencyIndicator]] = []
    for code, item in items_by_code.items():
        ind_res = await db.execute(
            select(CompetencyIndicator)
            .where(CompetencyIndicator.code == code)
            .options(selectinload(CompetencyIndicator.competency))
        )
        indicator = ind_res.scalars().first()
        if indicator is not None:
            resolved.append((item, indicator))
    if not resolved:
        return 0

    await db.execute(delete(RpdLearningOutcome).where(RpdLearningOutcome.id_rpd == rpd_id))
    await db.flush()

    for item, indicator in resolved:
        db.add(RpdLearningOutcome(
            id_rpd=rpd_id,
            id_indicator=indicator.id_indicator,
            indicator_code=indicator.code,
            indicator_description=indicator.description or None,
            competency_code=indicator.competency.code if indicator.competency else None,
            competency_name=indicator.competency.name if indicator.competency else None,
            outcome_text=(item.get("outcome_text") or "").strip() or None,
            assessment_tool=(item.get("assessment_tool") or "").strip() or None,
        ))
    await db.commit()
    return len(resolved)
