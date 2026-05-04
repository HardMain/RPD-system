"""Export RPD to PDF (через DOCX-шаблон + LibreOffice)."""
import asyncio
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from urllib.parse import quote

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models import (
    User, Rpd, Discipline, Direction, Bup, BupDiscipline, BupDisciplineCompetency,
    RpdSection, RpdTopic,
    RpdLiterature, RpdSoftware, RpdMaterialTech, RpdDatabase, RpdLearningOutcome,
    RpdDeveloper, ApprovalStage, CompetencyIndicator, Competency, UploadedDocument,
    RpdBupDiscipline,
)
# noqa импорты для удобства: build_context вытаскивает competency/indicator
# через цепочку bup_links → bup_discipline → competencies → competency → indicators,
# поэтому загружаем эту цепочку явно (см. _load_rpd ниже).
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
            selectinload(Rpd.discipline),
            selectinload(Rpd.bup_links)
                .selectinload(RpdBupDiscipline.bup_discipline)
                .selectinload(BupDiscipline.bup)
                .selectinload(Bup.direction),
            # competencies на BupDiscipline нужны для раздела 2 печатной формы:
            # build_context итерирует ВСЕ индикаторы выбранной БУП-привязки
            # (а не только те, по которым пользователь сохранил текст результата),
            # — те же индикаторы, что показывает OutcomesEditor в режиме edit.
            selectinload(Rpd.bup_links)
                .selectinload(RpdBupDiscipline.bup_discipline)
                .selectinload(BupDiscipline.competencies)
                .selectinload(BupDisciplineCompetency.competency)
                .selectinload(Competency.indicators),
            selectinload(Rpd.author),
            selectinload(Rpd.developers).selectinload(RpdDeveloper.user),
            selectinload(Rpd.sections),
            selectinload(Rpd.topics),
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


def _resolve_link(rpd: Rpd, bd_id: int | None) -> RpdBupDiscipline | None:
    """Возвращает RpdBupDiscipline-привязку, для которой формируется печатная форма.
    После hard-delete БУПа `link.id_bup_discipline` может быть None, но snapshot
    у link заполнен — этого достаточно для рендера."""
    links = list(rpd.bup_links or [])
    if not links:
        return None
    if bd_id is None:
        return links[0]
    for link in links:
        if link.id_bup_discipline == bd_id:
            return link
    raise HTTPException(status_code=400, detail="Эта БУП-дисциплина не привязана к РПД")


async def _render(rpd: Rpd, link: RpdBupDiscipline | None) -> bytes:
    if not os.path.exists(_TEMPLATE_DOCX):
        raise HTTPException(status_code=500, detail=f"Шаблон не найден: {_TEMPLATE_DOCX}")
    bd = link.bup_discipline if link else None
    context = build_context(rpd, bd=bd, link=link)
    try:
        return await asyncio.to_thread(render_rpd_pdf_bytes, _TEMPLATE_DOCX, context)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Ошибка рендера PDF: {exc}")


def _filename(rpd: Rpd, link: RpdBupDiscipline | None) -> str:
    d = rpd.discipline
    bd = link.bup_discipline if link else None
    code = (link.code if link and link.code else (bd.code if bd else None)) or "no_code"
    return (
        f"RPD_{code}_{d.name}_{rpd.academic_year}.pdf"
        .replace("/", "_").replace(" ", "_")
    )


@router.get("/{rpd_id}/pdf")
async def export_pdf(
    rpd_id: int,
    bd_id: int | None = Query(default=None, description="ID привязанной БУП-дисциплины — печатная форма для конкретной привязки. Без параметра — первая привязанная."),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Скачать PDF (attachment)."""
    rpd = await _load_rpd(db, rpd_id)
    link = _resolve_link(rpd, bd_id)
    pdf_bytes = await _render(rpd, link)
    encoded = quote(_filename(rpd, link), safe="")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded}"},
    )


@router.get("/{rpd_id}/pdf-inline")
async def export_pdf_inline(
    rpd_id: int,
    bd_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Отрисовать PDF inline — для встраивания в <iframe>/<embed> в режиме просмотра."""
    rpd = await _load_rpd(db, rpd_id)
    link = _resolve_link(rpd, bd_id)
    pdf_bytes = await _render(rpd, link)
    encoded = quote(_filename(rpd, link), safe="")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{encoded}",
            "Cache-Control": "no-store",
        },
    )
