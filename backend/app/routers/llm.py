import random
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.crud import assert_rpd_editable
from app.models import (
    User, Rpd, Discipline, Direction, Bup, BupDiscipline, LlmGenerationLog,
    UploadedDocument, UploadedDocumentSection, RpdBupDiscipline, LlmPrompt,
    RpdLearningOutcome, CompetencyIndicator, Competency, BupDisciplineCompetency,
    AssessmentTool,
)
from app.schemas import LlmGenerateRequest, LlmGenerateResponse
from app.services.llm_service import generate_section, extract_text_from_file, CONTEXT_CHAR_LIMIT, DOC_CONTEXT_LIMIT
from app.services.approved_context import approved_rpd_example
from app.services.dictionary_context import dictionary_catalog
from app.services.structured_generation import (
    parse_json_array,
    apply_content_sections,
    apply_topics,
    apply_literature,
    apply_software,
    apply_databases,
    apply_material_tech,
    apply_learning_outcomes,
    _PRINTED_SOURCE_TYPES,
)

router = APIRouter(prefix="/api/llm", tags=["llm"])

_LITERATURE_SECTION_KEYS = set(_PRINTED_SOURCE_TYPES.keys()) | {"literature_electronic"}
_TOPIC_SECTION_KEYS = {"topics_practice": "practice", "topics_lab": "lab"}

_SHORT_NEGATIVE_RE = re.compile(
    r"(не\s+предусмотр|не\s+треб|не\s+устан|отсутству|не\s+примен|нет\s+таковых|нет\b)",
    re.IGNORECASE,
)

_CONTROL_FORM_RE = re.compile(r"([а-яёА-ЯЁ\.\s]+?)\s*\(\s*[\d,\s]+\s*\)")


def _is_short_negative(text: str) -> bool:
    clean = (text or "").strip()
    return 0 < len(clean) <= 60 and bool(_SHORT_NEGATIVE_RE.search(clean))


def _filter_assessment_tools(tools: list[str], control_form: str | None,
                             lab_total: int, practice_total: int) -> list[str]:
    has_exam = False
    has_zachet = False
    has_diff_zachet = False
    has_course_project = False
    has_course_work = False
    has_control_work = False
    for m in _CONTROL_FORM_RE.finditer((control_form or "").lower()):
        label = m.group(1).strip()
        if "экзамен" in label:
            has_exam = True
        elif "диф" in label and "зач" in label:
            has_diff_zachet = True
        elif "зач" in label:
            has_zachet = True
        elif "курсов" in label and "проект" in label:
            has_course_project = True
        elif "курсов" in label and "работ" in label:
            has_course_work = True
        elif "контрольн" in label and "работ" in label:
            has_control_work = True

    def _keep(name: str) -> bool:
        nl = name.lower().strip()
        if nl == "экзамен":
            return has_exam
        if nl in ("зачёт", "зачет"):
            return has_zachet
        if "дифференцир" in nl or nl.startswith("диф"):
            return has_diff_zachet
        if "курсов" in nl and "проект" in nl:
            return has_course_project
        if "курсов" in nl and "работ" in nl:
            return has_course_work
        if "контрольн" in nl and "работ" in nl:
            return has_control_work
        if "лаборатор" in nl:
            return lab_total > 0
        if "практическ" in nl:
            return practice_total > 0
        return True

    return [t for t in tools if _keep(t)]


@router.post("/{rpd_id}/generate", response_model=LlmGenerateResponse)
async def generate(
    rpd_id: int,
    data: LlmGenerateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Rpd).where(Rpd.id_rpd == rpd_id)
        .options(
            selectinload(Rpd.discipline),
            selectinload(Rpd.bup_links)
                .selectinload(RpdBupDiscipline.bup_discipline)
                .selectinload(BupDiscipline.bup)
                .selectinload(Bup.direction),
            selectinload(Rpd.uploaded_documents),
        )
    )
    rpd = result.scalar_one_or_none()
    assert_rpd_editable(rpd, user)

    disc = rpd.discipline
    link = None
    if data.id_bup_discipline is not None:
        link = next(
            (l for l in (rpd.bup_links or []) if l.id_bup_discipline == data.id_bup_discipline),
            None,
        )
    if link is None:
        link = next(iter(rpd.bup_links or []), None)
    bd = link.bup_discipline if link else None
    direc = bd.bup.direction if bd and bd.bup else None

    def _hours(attr: str) -> int:
        v = getattr(link, attr, None) if link is not None else None
        if v is None and bd is not None:
            v = getattr(bd, attr, None)
        return v or 0

    def _pick_str(*candidates: str | None) -> str:
        for c in candidates:
            if c:
                s = c.strip() if isinstance(c, str) else c
                if s:
                    return s
        return ""

    direction_name = _pick_str(
        link.direction_name if link else None,
        direc.name if direc else None,
    )
    profile_text = _pick_str(
        link.bup_profile if link else None,
        bd.bup.profile if bd and bd.bup else None,
        link.direction_profile if link else None,
        direc.profile if direc else None,
    )
    sem_data_for_prompt = (link.semesters_data if link else None) or (bd.semesters_data if bd else None) or []

    extra_context = data.context or ""
    assessment_tools_str = ""

    if data.section == "learning_outcomes":
        all_bup_bd_ids = [
            l.id_bup_discipline for l in (rpd.bup_links or [])
            if l.id_bup_discipline is not None and not getattr(l, "is_manual", False)
        ]
        if data.id_bup_discipline is not None and data.id_bup_discipline in all_bup_bd_ids:
            bup_bd_ids = [data.id_bup_discipline]
        else:
            bup_bd_ids = all_bup_bd_ids
        bup_indicators: list[CompetencyIndicator] = []
        if bup_bd_ids:
            ind_res = await db.execute(
                select(CompetencyIndicator)
                .join(Competency, Competency.id_competency == CompetencyIndicator.id_competency)
                .join(BupDisciplineCompetency, BupDisciplineCompetency.id_competency == Competency.id_competency)
                .where(BupDisciplineCompetency.id_bup_discipline.in_(bup_bd_ids))
                .options(selectinload(CompetencyIndicator.competency))
                .order_by(Competency.code, CompetencyIndicator.code)
            )
            seen_inds: set[int] = set()
            for ind in ind_res.scalars().all():
                if ind.id_indicator in seen_inds:
                    continue
                seen_inds.add(ind.id_indicator)
                bup_indicators.append(ind)
            if bup_indicators:
                lines = [
                    "Индикаторы компетенций дисциплины (нужно заполнить для КАЖДОГО, не пропускай ни один и не добавляй чужих).",
                    "В JSON-ответе indicator_code должен быть ТОЛЬКО код индикатора без пояснений и скобок.",
                ]
                for ind in bup_indicators:
                    comp_code = ind.competency.code if ind.competency else ""
                    desc = (ind.description or "").strip()
                    lines.append(
                        f'  - indicator_code="{ind.code}", competency_code="{comp_code}": {desc}'
                    )
                extra_context = "\n".join(lines) + "\n\n" + extra_context

        lo_res = await db.execute(
            select(RpdLearningOutcome).where(RpdLearningOutcome.id_rpd == rpd_id)
        )
        lo_list = lo_res.scalars().all()
        catalog = (await db.execute(
            select(AssessmentTool.name).order_by(AssessmentTool.name)
        )).scalars().all()
        used = [
            (lo.assessment_tool or "").strip()
            for lo in lo_list
            if (lo.assessment_tool or "").strip()
        ]
        seen: set[str] = set()
        tools: list[str] = []
        for name in [*(c.strip() for c in catalog if c), *used]:
            key = name.lower()
            if name and key not in seen:
                seen.add(key)
                tools.append(name)
        control_form_for_filter = _pick_str(
            link.control_form if link else None,
            bd.control_form if bd else None,
        )
        lab_total_for_filter = 0
        practice_total_for_filter = 0
        sem_source = (link.semesters_data if link else None) or (bd.semesters_data if bd else None) or []
        if sem_source:
            for s in sem_source:
                lab_total_for_filter += (s.get("lab") or 0)
                practice_total_for_filter += (s.get("practice") or 0)
        else:
            lab_total_for_filter = (link.lab_hours if link else None) or (bd.lab_hours if bd else 0) or 0
            practice_total_for_filter = (link.practice_hours if link else None) or (bd.practice_hours if bd else 0) or 0
        tools = _filter_assessment_tools(
            tools, control_form_for_filter,
            lab_total_for_filter, practice_total_for_filter,
        )
        assessment_tools_str = "; ".join(tools)
        extra_context += (
            ("\n\n" if extra_context.strip() else "")
            + "ВАЖНО про assessment_tool: список «Доступные средства оценки» уже отфильтрован "
            + "под реальную структуру дисциплины (формы промежуточной аттестации из учебного плана "
            + "и распределение часов по видам работ). Чего нет в этом списке — того нет и в дисциплине. "
            + "Не пиши «Экзамен», если его в списке нет; не пиши «Защита лабораторной работы», "
            + "если нет лабораторных часов; и так далее. Бери assessment_tool СТРОГО из приведённого списка."
        )

    context_sources: list[str] = []

    catalog = await dictionary_catalog(db, data.section, disc.id_discipline if disc else None)
    if catalog:
        catalog_block, catalog_src = catalog
        extra_context += ("\n\n" if extra_context.strip() else "") + catalog_block
        context_sources.append(catalog_src)

    section_rows_res = await db.execute(
        select(UploadedDocumentSection, UploadedDocument)
        .join(UploadedDocument, UploadedDocument.id_document == UploadedDocumentSection.id_document)
        .where(UploadedDocumentSection.section_key == data.section)
        .where(UploadedDocument.id_rpd == rpd_id)
        .order_by(UploadedDocumentSection.created_at.desc())
        .limit(5)
    )
    section_rows = section_rows_res.all()

    parsed_ids_res = await db.execute(
        select(UploadedDocumentSection.id_document)
        .join(UploadedDocument, UploadedDocument.id_document == UploadedDocumentSection.id_document)
        .where(UploadedDocument.id_rpd == rpd_id)
        .distinct()
    )
    parsed_doc_ids = {row[0] for row in parsed_ids_res.all()}

    doc_budget = DOC_CONTEXT_LIMIT
    doc_parts: list[str] = []

    for chunk, doc in section_rows:
        if doc_budget <= 0:
            break
        content = (chunk.content or "")[:doc_budget]
        if not content:
            continue
        doc_parts.append(
            f"=== ИСТОЧНИК — документ преподавателя «{doc.filename}», распознанный раздел ===\n"
            + content
        )
        context_sources.append(f"Документ: {doc.filename} (раздел, {len(content)} симв.)")
        doc_budget -= len(content)

    for doc in rpd.uploaded_documents or []:
        if doc_budget <= 0:
            break
        if doc.id_document in parsed_doc_ids:
            continue
        text = await extract_text_from_file(doc.file_path)
        if not text:
            continue
        snippet = text[:doc_budget]
        doc_parts.append(
            f"=== ИСТОЧНИК — документ преподавателя «{doc.filename}», без разметки разделов ===\n"
            + snippet
        )
        context_sources.append(f"Документ: {doc.filename} (целиком, {len(snippet)} симв.)")
        doc_budget -= len(snippet)

    if doc_parts:
        extra_context += ("\n\n" if extra_context.strip() else "") + "\n\n".join(doc_parts)

    approved = await approved_rpd_example(db, rpd, data.section)
    if approved:
        approved_block, approved_src, approved_text = approved
        extra_context += ("\n\n" if extra_context.strip() else "") + approved_block
        context_sources.append(approved_src)
        if _is_short_negative(approved_text):
            if random.random() < 0.5:
                mode_label = "краткий ответ"
                extra_context += (
                    "\n\nЗАМЕЧАНИЕ к образцу выше: в нём раздел заполнен лаконичным "
                    "отказом («" + approved_text.strip() + "»). Это допустимый способ "
                    "оформления — ответь так же коротко, без расширения и без выдумывания "
                    "содержания. Достаточно одной короткой фразы аналогичного смысла."
                )
            else:
                mode_label = "развёрнутый ответ"
                extra_context += (
                    "\n\nЗАМЕЧАНИЕ к образцу выше: в нём раздел заполнен лаконичным "
                    "отказом («" + approved_text.strip() + "»), но для текущей "
                    "дисциплины сформулируй РЕАЛЬНОЕ содержание раздела (например, "
                    "для входных требований — необходимые пререквизиты, ранее изученные "
                    "дисциплины и базовые знания). Не повторяй короткий отказ из "
                    "образца — напиши развёрнутый осмысленный текст по предмету."
                )
            context_sources[-1] = approved_src + " — режим: " + mode_label

    prompt_row = (await db.execute(
        select(LlmPrompt).where(LlmPrompt.section_key == data.section)
    )).scalar_one_or_none()

    semesters_plan: dict[int, dict] = {}
    semesters_plan_text = ""
    if data.section == "content":
        sem_data = sem_data_for_prompt
        if len(sem_data) > 1:
            lines = [
                f"Дисциплина охватывает {len(sem_data)} семестра(-ов). "
                "Создавай разделы для каждого семестра отдельно согласно плану:"
            ]
            for s in sem_data:
                num = s.get("number", "?")
                lec = s.get("lecture", 0) or 0
                prac = s.get("practice", 0) or 0
                lab = s.get("lab", 0) or 0
                srs = s.get("srs", 0) or 0
                lines.append(
                    f"  - Семестр {num}: лекции {lec} ч, практики {prac} ч, "
                    f"лабораторные {lab} ч, СРС {srs} ч"
                )
                if isinstance(num, int):
                    semesters_plan[num] = {"lecture": lec, "practice": prac, "lab": lab, "srs": srs}
            lines.append(
                'В JSON для каждого раздела добавь поле "semester": N (номер семестра из списка выше).'
            )
            semesters_plan_text = "\n".join(lines)
        elif sem_data:
            num = sem_data[0].get("number")
            if isinstance(num, int):
                s = sem_data[0]
                semesters_plan[num] = {
                    "lecture": s.get("lecture", 0) or 0,
                    "practice": s.get("practice", 0) or 0,
                    "lab": s.get("lab", 0) or 0,
                    "srs": s.get("srs", 0) or 0,
                }
                semesters_plan_text = (
                    f'Все разделы относятся к семестру {num}. '
                    f'В JSON для каждого раздела добавь поле "semester": {num}.'
                )

    gen = await generate_section(
        section=data.section,
        discipline=disc.name,
        direction=direction_name,
        profile=profile_text,
        total_hours=_hours("total_hours"),
        lecture_hours=_hours("lecture_hours"),
        practice_hours=_hours("practice_hours"),
        lab_hours=_hours("lab_hours"),
        self_study_hours=_hours("self_study_hours"),
        extra_context=extra_context,
        semesters_plan=semesters_plan_text,
        assessment_tools=assessment_tools_str,
        user_prompt_template_override=prompt_row.user_prompt_template if prompt_row else None,
        system_prompt_override=prompt_row.system_prompt if prompt_row else None,
    )

    log = LlmGenerationLog(
        id_rpd=rpd_id,
        section_name=data.section,
        prompt_hash=gen.get("prompt_hash", ""),
        model_name=gen["model"],
        tokens_used=gen["tokens_used"],
        generation_time_ms=gen["generation_time_ms"],
        context_sources="\n".join(context_sources) or None,
    )
    db.add(log)
    await db.commit()

    structural_created = 0
    parsed_items_count: int | None = None
    cancelled = await request.is_disconnected()
    if gen["model"] != "fallback" and not cancelled:
        items = parse_json_array(gen["generated_text"])
        parsed_items_count = len(items) if items is not None else None
        if items:
            if data.section == "content":
                structural_created = await apply_content_sections(
                    db, rpd, items,
                    semester_plan=semesters_plan,
                    total_lecture=_hours("lecture_hours"),
                    total_practice=_hours("practice_hours"),
                    total_lab=_hours("lab_hours"),
                    total_srs=_hours("self_study_hours"),
                )
            elif data.section in _TOPIC_SECTION_KEYS:
                structural_created = await apply_topics(
                    db, rpd_id, items, _TOPIC_SECTION_KEYS[data.section]
                )
            elif data.section in _LITERATURE_SECTION_KEYS:
                structural_created = await apply_literature(db, rpd_id, items, data.section)
            elif data.section == "software":
                structural_created = await apply_software(db, rpd_id, items)
            elif data.section == "databases":
                structural_created = await apply_databases(db, rpd_id, items)
            elif data.section == "material_tech":
                structural_created = await apply_material_tech(db, rpd_id, items)
            elif data.section == "learning_outcomes":
                structural_created = await apply_learning_outcomes(
                    db, rpd_id, items, id_bup_discipline=data.id_bup_discipline,
                )
                if structural_created:
                    from datetime import datetime, timezone
                    rpd.updated_at = datetime.now(timezone.utc)
                    await db.commit()

    return LlmGenerateResponse(
        section=data.section,
        generated_text=gen["generated_text"],
        model=gen["model"],
        tokens_used=gen["tokens_used"],
        structural_created=structural_created,
        parsed_items_count=parsed_items_count,
        context_chars=min(len(extra_context), CONTEXT_CHAR_LIMIT),
        context_limit=CONTEXT_CHAR_LIMIT,
        context_sources=context_sources,
    )


@router.get("/{rpd_id}/logs")
async def get_generation_logs(
    rpd_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(LlmGenerationLog)
        .where(LlmGenerationLog.id_rpd == rpd_id)
        .order_by(LlmGenerationLog.created_at.desc())
        .limit(50)
    )
    logs = result.scalars().all()
    return [
        {
            "id_log": l.id_log,
            "section_name": l.section_name,
            "model_name": l.model_name,
            "tokens_used": l.tokens_used,
            "generation_time_ms": l.generation_time_ms,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]
