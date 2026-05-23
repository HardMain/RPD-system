from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Rpd, RpdBupDiscipline

APPROVED_STATUS = "Согласовано"

_TEXT_FIELD = {
    "objects": "objects_text",
    "requirements": "requirements_text",
    "educational_tech": "educational_tech",
    "methodical_recommendations": "methodical_recommendations",
}

_LIT_SOURCE_TYPE = {
    "literature_printed_main": "Учебные и научные издания",
    "literature_printed_additional": "Учебные и научные издания (дополнительные)",
    "literature_additional_books": "Учебные и научные издания (дополнительные)",
    "literature_periodicals": "Периодические издания",
    "literature_normative": "Нормативно-технические издания",
    "literature_methodical_students": "Методические указания для студентов по освоению дисциплины",
    "literature_methodical_self_study": "Учебно-методическое обеспечение самостоятельной работы студента",
}


def _fmt_lit(lit) -> str:
    parts = [lit.title or ""]
    if lit.url:
        parts.append(lit.url)
    return " ".join(p for p in parts if p).strip()


def _section_text(rpd: Rpd, section_key: str) -> str:
    if section_key == "goals":
        parts = []
        if rpd.goals_text:
            parts.append(rpd.goals_text.strip())
        if rpd.tasks_text:
            parts.append("Задачи:\n" + rpd.tasks_text.strip())
        return "\n\n".join(parts)
    if section_key in _TEXT_FIELD:
        return (getattr(rpd, _TEXT_FIELD[section_key]) or "").strip()
    if section_key == "content":
        rows = sorted(rpd.sections, key=lambda s: (s.section_number or 0))
        return "\n".join(
            f"{s.section_number}. {s.title}\n{(s.brief_content or '').strip()}"
            for s in rows
        ).strip()
    if section_key in ("topics_lab", "topics_practice"):
        tt = "lab" if section_key == "topics_lab" else "practice"
        rows = [t for t in rpd.topics if t.topic_type == tt]
        return "\n".join(f"{i + 1}. {t.title}" for i, t in enumerate(rows)).strip()
    if section_key == "learning_outcomes":
        lines = []
        for o in rpd.learning_outcomes:
            comp = (o.competency_code or "").strip()
            code = (o.indicator_code or "").strip()
            desc = (o.indicator_description or "").strip()
            res = (o.outcome_text or "").strip()
            tool = (o.assessment_tool or "").strip()
            line = f"{comp} {code}: {desc} → {res}".strip()
            if tool:
                line += f" (оценка: {tool})"
            lines.append(line)
        return "\n".join(lines).strip()
    if section_key in _LIT_SOURCE_TYPE:
        st = _LIT_SOURCE_TYPE[section_key]
        rows = [l for l in rpd.literature if (l.source_type or "") == st]
        return "\n".join(_fmt_lit(l) for l in rows).strip()
    if section_key == "literature_electronic":
        rows = [l for l in rpd.literature if "электрон" in (l.source_type or "").lower()]
        return "\n".join(_fmt_lit(l) for l in rows).strip()
    if section_key == "software":
        return "\n".join(
            (s.name or "")
            + (f" ({s.license_type})" if s.license_type else "")
            for s in rpd.software
        ).strip()
    if section_key == "databases":
        return "\n".join(
            d.name + (f" — {d.url}" if d.url else "") for d in rpd.databases
        ).strip()
    if section_key == "material_tech":
        return "\n".join(
            f"{m.room_type}: {(m.equipment or '').strip()}"
            + (f" ({m.quantity})" if m.quantity else "")
            for m in rpd.material_tech
        ).strip()
    return ""


_LOADS = (
    selectinload(Rpd.discipline),
    selectinload(Rpd.sections),
    selectinload(Rpd.topics),
    selectinload(Rpd.learning_outcomes),
    selectinload(Rpd.literature),
    selectinload(Rpd.software),
    selectinload(Rpd.databases),
    selectinload(Rpd.material_tech),
)


async def approved_rpd_example(
    db: AsyncSession, current_rpd: Rpd, section_key: str, *, max_chars: int = 4000
) -> tuple[str, str, str] | None:
    link = current_rpd.bup_links[0] if current_rpd.bup_links else None
    dir_code = link.direction_code if link else None

    same_disc_stmt = (
        select(Rpd)
        .where(
            Rpd.status == APPROVED_STATUS,
            Rpd.id_rpd != current_rpd.id_rpd,
            Rpd.id_discipline == current_rpd.id_discipline,
        )
        .order_by(Rpd.updated_at.desc())
        .limit(10)
        .options(*_LOADS)
    )
    same_dir_stmt = (
        select(Rpd)
        .join(RpdBupDiscipline, RpdBupDiscipline.id_rpd == Rpd.id_rpd)
        .where(
            Rpd.status == APPROVED_STATUS,
            Rpd.id_rpd != current_rpd.id_rpd,
            RpdBupDiscipline.direction_code == dir_code,
        )
        .order_by(Rpd.updated_at.desc())
        .limit(10)
        .distinct()
        .options(*_LOADS)
    ) if dir_code else None
    any_appr_stmt = (
        select(Rpd)
        .where(
            Rpd.status == APPROVED_STATUS,
            Rpd.id_rpd != current_rpd.id_rpd,
        )
        .order_by(Rpd.updated_at.desc())
        .limit(20)
        .options(*_LOADS)
    )

    levels: list[tuple[str, object]] = [("по той же дисциплине", same_disc_stmt)]
    if same_dir_stmt is not None:
        levels.append(("по тому же направлению", same_dir_stmt))
    levels.append(("образец заполнения раздела (другая дисциплина)", any_appr_stmt))

    seen_ids: set[int] = set()
    for label, stmt in levels:
        candidates = list((await db.execute(stmt)).scalars().all())
        for cand in candidates:
            if cand.id_rpd in seen_ids:
                continue
            seen_ids.add(cand.id_rpd)
            text = _section_text(cand, section_key)
            if text and len(text) >= 3:
                disc = cand.discipline.name if cand.discipline else "дисциплина"
                trimmed = text[:max_chars]
                block = (
                    f"=== ИСТОЧНИК — согласованная РПД «{disc}», {label} ===\n"
                    + trimmed
                )
                return block, f"Согласованная РПД «{disc}» ({label})", trimmed
    return None
