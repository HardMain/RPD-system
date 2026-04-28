"""Export RPD to PDF (через DOCX-шаблон + LibreOffice)."""
import asyncio
import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from urllib.parse import quote

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models import (
    User, Rpd, Discipline, Direction, RpdSection, RpdTopic,
    RpdLiterature, RpdSoftware, RpdMaterialTech, RpdDatabase, RpdLearningOutcome,
    RpdDeveloper, ApprovalStage, CompetencyIndicator, Competency, UploadedDocument,
    RpdBupDiscipline,
)
from app.services.docx_renderer import render_rpd_pdf_bytes
from app.services.rpd_template_context import build_context

router = APIRouter(prefix="/api/export", tags=["export"])

_TEMPLATE_DOCX = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "templates", "rpd_template.docx")
)


async def _load_rpd(db: AsyncSession, rpd_id: int) -> Rpd:
    result = await db.execute(
        select(Rpd).where(Rpd.id_rpd == rpd_id)
        .options(
            selectinload(Rpd.discipline).selectinload(Discipline.direction),
            selectinload(Rpd.bup_links).selectinload(RpdBupDiscipline.bup_discipline),
            selectinload(Rpd.author),
            selectinload(Rpd.developers).selectinload(RpdDeveloper.user),
            selectinload(Rpd.sections).selectinload(RpdSection.topics),
            selectinload(Rpd.literature),
            selectinload(Rpd.software),
            selectinload(Rpd.material_tech),
            selectinload(Rpd.databases),
            selectinload(Rpd.learning_outcomes)
                .selectinload(RpdLearningOutcome.indicator)
                .selectinload(CompetencyIndicator.competency),
        )
    )
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")
    return rpd


async def _render(rpd: Rpd) -> bytes:
    if not os.path.exists(_TEMPLATE_DOCX):
        raise HTTPException(status_code=500, detail=f"Шаблон не найден: {_TEMPLATE_DOCX}")
    context = build_context(rpd)
    try:
        return await asyncio.to_thread(render_rpd_pdf_bytes, _TEMPLATE_DOCX, context)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Ошибка рендера PDF: {exc}")


def _filename(rpd: Rpd) -> str:
    d = rpd.discipline
    bd = next((l.bup_discipline for l in (rpd.bup_links or []) if l.bup_discipline), None)
    code = (bd.code if bd else None) or "no_code"
    return (
        f"RPD_{code}_{d.name}_{rpd.academic_year}.pdf"
        .replace("/", "_").replace(" ", "_")
    )


@router.get("/{rpd_id}/pdf")
async def export_pdf(
    rpd_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Скачать PDF (attachment)."""
    rpd = await _load_rpd(db, rpd_id)
    pdf_bytes = await _render(rpd)
    encoded = quote(_filename(rpd), safe="")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded}"},
    )


@router.get("/{rpd_id}/pdf-inline")
async def export_pdf_inline(
    rpd_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Отрисовать PDF inline — для встраивания в <iframe>/<embed> в режиме просмотра."""
    rpd = await _load_rpd(db, rpd_id)
    pdf_bytes = await _render(rpd)
    encoded = quote(_filename(rpd), safe="")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{encoded}",
            "Cache-Control": "no-store",
        },
    )
