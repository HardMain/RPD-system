import random
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user, user_can
from app.core.crud import assert_rpd_editable
from app.models import (
    User, Rpd, Discipline, Direction, Bup, BupDiscipline, LlmGenerationLog,
    UploadedDocument, UploadedDocumentSection, RpdBupDiscipline, LlmPrompt,
    RpdLearningOutcome, CompetencyIndicator, AssessmentTool,
)
from app.schemas import LlmGenerateRequest, LlmGenerateResponse
from app.services.llm_service import generate_section, extract_text_from_file, CONTEXT_CHAR_LIMIT
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


def _is_short_negative(text: str) -> bool:
    clean = (text or "").strip()
    return 0 < len(clean) <= 60 and bool(_SHORT_NEGATIVE_RE.search(clean))


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
        lo_res = await db.execute(
            select(RpdLearningOutcome)
            .where(RpdLearningOutcome.id_rpd == rpd_id)
            .options(selectinload(RpdLearningOutcome.indicator))
        )
        lo_list = lo_res.scalars().all()
        if lo_list:
            lines = ["Индикаторы компетенций дисциплины (нужно заполнить для каждого):"]
            for lo in lo_list:
                ind = lo.indicator
                code = lo.indicator_code or (ind.code if ind else None)
                comp_code = lo.competency_code or ""
                desc = (ind.description if ind else None) or ""
                if code:
                    lines.append(f"  {code} ({comp_code}): {desc}")
            extra_context = "\n".join(lines) + "\n\n" + extra_context

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
        assessment_tools_str = "; ".join(tools)

    context_sources: list[str] = []

    catalog = await dictionary_catalog(db, data.section, disc.id_discipline if disc else None)
    if catalog:
        catalog_block, catalog_src = catalog
        extra_context += ("\n\n" if extra_context.strip() else "") + catalog_block
        context_sources.append(catalog_src)

    sections_res = await db.execute(
        select(UploadedDocumentSection, UploadedDocument)
        .join(UploadedDocument, UploadedDocument.id_document == UploadedDocumentSection.id_document)
        .where(UploadedDocumentSection.section_key == data.section)
        .where(UploadedDocument.id_rpd == rpd_id)
        .order_by(UploadedDocumentSection.created_at.desc())
        .limit(5)
    )
    section_rows = sections_res.all()

    if section_rows:
        examples = []
        for chunk, doc in section_rows:
            examples.append(
                f"=== ИСТОЧНИК — документ преподавателя «{doc.filename}», распознанный раздел ===\n"
                + chunk.content
            )
            context_sources.append(f"Документ: {doc.filename} (раздел)")
        extra_context += ("\n\n" if extra_context.strip() else "") + "\n\n".join(examples)
    else:
        docs_to_use = list(rpd.uploaded_documents or [])
        if docs_to_use:
            doc_texts = []
            for doc in docs_to_use[:5]:
                text = await extract_text_from_file(doc.file_path)
                if text:
                    doc_texts.append(
                        f"=== ИСТОЧНИК — документ преподавателя «{doc.filename}», без разметки разделов ===\n"
                        + text
                    )
                    context_sources.append(f"Документ: {doc.filename} (целиком)")
            if doc_texts:
                extra_context += ("\n\n" if extra_context.strip() else "") + "\n\n".join(doc_texts)

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
    cancelled = await request.is_disconnected()
    if gen["model"] != "fallback" and not cancelled:
        items = parse_json_array(gen["generated_text"])
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
                outcomes_structural = (
                    any(getattr(l, "is_manual", False) for l in rpd.bup_links)
                    or user_can(user, "sources.manage")
                )
                structural_created = await apply_learning_outcomes(
                    db, rpd_id, items, outcomes_structural
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
