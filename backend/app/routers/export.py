"""Export RPD to PDF / DOCX."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import (
    User, Rpd, Discipline, Direction, RpdSection, RpdTopic,
    RpdLiterature, RpdSoftware, RpdMaterialTech, RpdLearningOutcome,
    RpdDeveloper, ApprovalStage, CompetencyIndicator, UploadedDocument,
)
from app.services.pdf_service import generate_rpd_pdf

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/{rpd_id}/pdf")
async def export_pdf(
    rpd_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Rpd).where(Rpd.id_rpd == rpd_id)
        .options(
            selectinload(Rpd.discipline).selectinload(Discipline.direction),
            selectinload(Rpd.author),
            selectinload(Rpd.sections).selectinload(RpdSection.topics),
            selectinload(Rpd.literature),
            selectinload(Rpd.software),
            selectinload(Rpd.material_tech),
            selectinload(Rpd.learning_outcomes).selectinload(RpdLearningOutcome.indicator),
        )
    )
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")

    d = rpd.discipline
    rpd_data = {
        "discipline_name": d.name,
        "discipline_code": d.code,
        "direction_name": d.direction.name,
        "direction_code": d.direction.code,
        "direction_profile": d.direction.profile,
        "academic_year": rpd.academic_year,
        "semester": d.semester,
        "control_form": d.control_form,
        "total_hours": d.total_hours,
        "goals_text": rpd.goals_text,
        "tasks_text": rpd.tasks_text,
        "objects_text": rpd.objects_text,
        "requirements_text": rpd.requirements_text,
        "educational_tech": rpd.educational_tech,
        "methodical_recommendations": rpd.methodical_recommendations,
        "sections": [
            {
                "section_number": s.section_number,
                "title": s.title,
                "brief_content": s.brief_content,
                "lecture_hours": s.lecture_hours,
                "practice_hours": s.practice_hours,
                "lab_hours": s.lab_hours,
                "self_study_hours": s.self_study_hours,
            }
            for s in rpd.sections
        ],
        "literature": [
            {
                "source_type": l.source_type,
                "title": l.title,
                "authors": l.authors,
                "year": l.year,
                "publisher": l.publisher,
            }
            for l in rpd.literature
        ],
        "software": [
            {"name": s.name, "license_type": s.license_type}
            for s in rpd.software
        ],
        "material_tech": [
            {"room_type": m.room_type, "equipment": m.equipment}
            for m in rpd.material_tech
        ],
    }

    pdf_bytes = generate_rpd_pdf(rpd_data)
    filename = f"RPD_{d.code or 'no_code'}_{d.name}_{rpd.academic_year}.pdf".replace("/", "_").replace(" ", "_")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
