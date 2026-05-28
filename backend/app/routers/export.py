import asyncio
import os
import re

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
    RpdBupDiscipline, RpdApprovalRoute, RpdFosFile, StoredFile,
)
from app.services import storage_service
from app.services.docx_renderer import render_rpd_pdf_bytes
from app.services.rpd_template_context import build_context
from app.services.app_settings import (
    get_approver, get_approver_signature_file_id, get_approver_signature_position,
)
from app.services.pdf_overlay import overlay_signature

router = APIRouter(prefix="/api/export", tags=["export"])

_TEMPLATES_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "templates")
)
_TEMPLATE_APPROVED = os.path.join(_TEMPLATES_DIR, "rpd_template.docx")
_TEMPLATE_PROJECT = os.path.join(_TEMPLATES_DIR, "rpd_template_substrate.docx")

async def _load_rpd(db: AsyncSession, rpd_id: int) -> Rpd:
    result = await db.execute(
        select(Rpd).where(Rpd.id_rpd == rpd_id)
        .options(
            selectinload(Rpd.discipline),
            selectinload(Rpd.bup_links)
                .selectinload(RpdBupDiscipline.bup_discipline)
                .selectinload(BupDiscipline.bup)
                .selectinload(Bup.direction),
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
            selectinload(Rpd.approval_route),
            selectinload(Rpd.fos_files).selectinload(RpdFosFile.file),
        )
    )
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")
    return rpd


def _final_approval_date(rpd: Rpd):
    if (rpd.status or "").strip() != "Согласовано":
        return None
    route = list(rpd.approval_route or [])
    if not route:
        return None
    approved = [step.reviewed_at for step in route if step.status == "approved" and step.reviewed_at]
    if not approved:
        return None
    return max(approved)

def _resolve_link(rpd: Rpd, bd_id: int | None) -> RpdBupDiscipline | None:
    links = list(rpd.bup_links or [])
    if not links:
        return None
    if bd_id is None:
        return links[0]
    for link in links:
        if link.id_bup_discipline == bd_id:
            return link
    raise HTTPException(status_code=400, detail="Эта БУП-дисциплина не привязана к РПД")

async def _load_signature_bytes(db: AsyncSession) -> bytes | None:
    file_id = await get_approver_signature_file_id()
    if not file_id:
        return None
    sf = await db.get(StoredFile, file_id)
    if not sf:
        return None
    try:
        return storage_service.read_bytes(sf.storage_uri)
    except Exception:
        return None


def _load_fos_main_bytes(rpd: Rpd) -> bytes | None:
    for link in (rpd.fos_files or []):
        if link.role == "main" and link.file:
            try:
                return storage_service.read_bytes(link.file.storage_uri)
            except Exception:
                return None
    return None


def _merge_pdfs(rpd_pdf: bytes, fos_pdf: bytes) -> bytes:
    import fitz
    out = fitz.open()
    a = fitz.open(stream=rpd_pdf, filetype="pdf")
    out.insert_pdf(a)
    a.close()
    b = fitz.open(stream=fos_pdf, filetype="pdf")
    out.insert_pdf(b)
    b.close()
    data = out.tobytes()
    out.close()
    return data


async def _render(rpd: Rpd, link: RpdBupDiscipline | None, db: AsyncSession) -> bytes:
    is_approved = (rpd.status or "").strip() == "Согласовано"
    template_path = _TEMPLATE_APPROVED if is_approved else _TEMPLATE_PROJECT
    if not os.path.exists(template_path):
        raise HTTPException(status_code=500, detail=f"Шаблон не найден: {template_path}")
    bd = link.bup_discipline if link else None
    approver = await get_approver()
    signature_bytes = await _load_signature_bytes(db) if is_approved else None
    approval_date = _final_approval_date(rpd)
    context = build_context(rpd, bd=bd, link=link, approver=approver, approval_date=approval_date)
    try:
        rpd_pdf = await asyncio.to_thread(render_rpd_pdf_bytes, template_path, context, None)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ошибка рендера PDF: {exc}")
    if signature_bytes:
        position = await get_approver_signature_position()
        try:
            rpd_pdf = await asyncio.to_thread(
                overlay_signature, rpd_pdf, signature_bytes,
                position["x"], position["y"],
                position["width_mm"], position["height_mm"],
            )
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Ошибка наложения подписи: {exc}")
    fos_bytes = _load_fos_main_bytes(rpd)
    if fos_bytes:
        try:
            rpd_pdf = await asyncio.to_thread(_merge_pdfs, rpd_pdf, fos_bytes)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Ошибка склейки ФОС: {exc}")
    return rpd_pdf

_DEGREE_ABBR = {
    "бакалавриат": "б",
    "магистратура": "м",
    "специалитет": "с",
    "аспирантура": "а",
}

_ABBR_STOPWORDS = {"и", "в", "на", "по", "с", "у", "от", "для", "о", "об", "к", "до"}

_FORBIDDEN_FN_CHARS = re.compile(r'[\\/:*?"<>|]+')


def _abbreviate(text: str | None) -> str:
    if not text:
        return ""
    cleaned = text.strip().strip('"«»')
    words = [w for w in re.split(r"[\s\-/]+", cleaned) if w]
    significant = [w for w in words if w.lower() not in _ABBR_STOPWORDS]
    if not significant:
        return ""
    if len(significant) == 1:
        w = significant[0]
        return w if len(w) <= 8 else w[:8]
    return "".join(w[0].upper() for w in significant if w and w[0].isalpha())


def _abbreviate_faculty(name: str | None) -> str:
    if not name:
        return ""
    cleaned = name.strip().strip('"«»')
    words = [w for w in re.split(r"[\s\-/]+", cleaned) if w]
    significant = [
        w for w in words
        if w.lower() not in _ABBR_STOPWORDS and w.lower() != "факультет"
    ]
    if not significant:
        return ""
    if len(significant) == 1 and significant[0].isupper():
        return significant[0]
    first = significant[0]
    stem = first[:3]
    stem = stem[:1].upper() + stem[1:].lower()
    return stem + "Ф"


def _degree_short(level: str | None) -> str:
    if not level:
        return ""
    return _DEGREE_ABBR.get(level.strip().lower(), "")


def _sanitize_part(s: str) -> str:
    s = _FORBIDDEN_FN_CHARS.sub("", s).strip()
    s = re.sub(r"\s+", "_", s)
    return s


def _filename(rpd: Rpd, link: RpdBupDiscipline | None) -> str:
    d = rpd.discipline
    parts: list[str] = []
    if d and d.name:
        parts.append(d.name)
    if link and link.bup_year:
        parts.append(str(link.bup_year))
        bd = link.bup_discipline
        faculty = bd.bup.faculty if (bd and bd.bup and bd.bup.faculty) else None
        faculty_abbr = _abbreviate_faculty(faculty)
        if faculty_abbr:
            parts.append(faculty_abbr)
        profile_abbr = _abbreviate(link.bup_profile or link.direction_profile)
        if profile_abbr:
            parts.append(profile_abbr)
        degree = _degree_short(link.degree_level)
        if degree:
            parts.append(degree)
    elif rpd.academic_year:
        parts.append(rpd.academic_year.replace("/", "-"))
    sanitized = [p for p in (_sanitize_part(p) for p in parts) if p]
    if not sanitized:
        return f"RPD_{rpd.id_rpd}.pdf"
    return "_".join(sanitized) + ".pdf"

@router.get("/{rpd_id}/pdf")
async def export_pdf(
    rpd_id: int,
    bd_id: int | None = Query(default=None, description="ID привязанной БУП-дисциплины — печатная форма для конкретной привязки. Без параметра — первая привязанная."),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rpd = await _load_rpd(db, rpd_id)
    link = _resolve_link(rpd, bd_id)
    pdf_bytes = await _render(rpd, link, db)
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
    rpd = await _load_rpd(db, rpd_id)
    link = _resolve_link(rpd, bd_id)
    pdf_bytes = await _render(rpd, link, db)
    encoded = quote(_filename(rpd, link), safe="")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{encoded}",
            "Cache-Control": "no-store",
        },
    )
