from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models import (
    User, Rpd, Discipline, Direction, Bup, BupDiscipline, LlmGenerationLog,
    UploadedDocument, RpdBupDiscipline,
)
from app.schemas import LlmGenerateRequest, LlmGenerateResponse
from app.services.llm_service import generate_section, extract_text_from_file

router = APIRouter(prefix="/api/llm", tags=["llm"])

@router.post("/{rpd_id}/generate", response_model=LlmGenerateResponse)
async def generate(
    rpd_id: int,
    data: LlmGenerateRequest,
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
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")

    disc = rpd.discipline
    bd = next((l.bup_discipline for l in rpd.bup_links if l.bup_discipline), None)
    direc = bd.bup.direction if bd and bd.bup else None

    extra_context = data.context or ""
    docs_to_use = list(rpd.uploaded_documents or [])
    global_docs_res = await db.execute(
        select(UploadedDocument).where(UploadedDocument.id_rpd.is_(None))
    )
    docs_to_use.extend(global_docs_res.scalars().all())
    if docs_to_use:
        doc_texts = []
        for doc in docs_to_use[:8]:
            text = await extract_text_from_file(doc.file_path)
            if text:
                doc_texts.append(f"--- {doc.filename} ---\n{text}")
        if doc_texts:
            extra_context += "\n\n" + "\n\n".join(doc_texts)

    gen = await generate_section(
        section=data.section,
        discipline=disc.name,
        direction=direc.name if direc else "",
        profile=(bd.bup.profile if bd and bd.bup else None) or (direc.profile if direc else "") or "",
        total_hours=(bd.total_hours if bd else 0) or 0,
        lecture_hours=(bd.lecture_hours if bd else 0) or 0,
        practice_hours=(bd.practice_hours if bd else 0) or 0,
        lab_hours=(bd.lab_hours if bd else 0) or 0,
        self_study_hours=(bd.self_study_hours if bd else 0) or 0,
        extra_context=extra_context,
    )

    log = LlmGenerationLog(
        id_rpd=rpd_id,
        section_name=data.section,
        prompt_hash=gen.get("prompt_hash", ""),
        model_name=gen["model"],
        tokens_used=gen["tokens_used"],
        generation_time_ms=gen["generation_time_ms"],
    )
    db.add(log)
    await db.commit()

    return LlmGenerateResponse(
        section=data.section,
        generated_text=gen["generated_text"],
        model=gen["model"],
        tokens_used=gen["tokens_used"],
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
