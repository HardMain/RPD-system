"""Export RPD to PDF / DOCX."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from urllib.parse import quote

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import (
    User, Rpd, Discipline, Direction, RpdSection, RpdTopic,
    RpdLiterature, RpdSoftware, RpdMaterialTech, RpdLearningOutcome,
    RpdDeveloper, ApprovalStage, CompetencyIndicator, Competency, UploadedDocument,
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
            selectinload(Rpd.developers).selectinload(RpdDeveloper.user),
            selectinload(Rpd.sections).selectinload(RpdSection.topics),
            selectinload(Rpd.literature),
            selectinload(Rpd.software),
            selectinload(Rpd.material_tech),
            selectinload(Rpd.learning_outcomes)
                .selectinload(RpdLearningOutcome.indicator)
                .selectinload(CompetencyIndicator.competency),
        )
    )
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")

    d = rpd.discipline
    dir_ = d.direction

    rpd_data = {
        "discipline_name": d.name,
        "discipline_code": d.code,
        "direction_name": dir_.name,
        "direction_code": dir_.code,
        "direction_profile": dir_.profile,
        "degree_level": dir_.degree_level or "бакалавр",
        "academic_year": rpd.academic_year,
        "semester": d.semester,
        "control_form": d.control_form,
        "total_hours": d.total_hours,
        "lecture_hours": d.lecture_hours,
        "practice_hours": d.practice_hours,
        "lab_hours": d.lab_hours,
        "self_study_hours": d.self_study_hours,
        "goals_text": rpd.goals_text,
        "tasks_text": rpd.tasks_text,
        "objects_text": rpd.objects_text,
        "requirements_text": rpd.requirements_text,
        "educational_tech": rpd.educational_tech,
        "methodical_recommendations": rpd.methodical_recommendations,
        "developers": [
            {"full_name": dev.user.full_name}
            for dev in rpd.developers
        ],
        "sections": [
            {
                "section_number": s.section_number,
                "title": s.title,
                "brief_content": s.brief_content,
                "lecture_hours": s.lecture_hours,
                "practice_hours": s.practice_hours,
                "lab_hours": s.lab_hours,
                "self_study_hours": s.self_study_hours,
                "topics": [
                    {
                        "topic_type": t.topic_type,
                        "title": t.title,
                        "hours": t.hours,
                        "description": t.description,
                    }
                    for t in s.topics
                ],
            }
            for s in rpd.sections
        ],
        "learning_outcomes": [
            {
                "competency_code": lo.indicator.competency.code if lo.indicator and lo.indicator.competency else "",
                "competency_name": lo.indicator.competency.name if lo.indicator and lo.indicator.competency else "",
                "indicator_code": lo.indicator.code if lo.indicator else "",
                "indicator_description": lo.indicator.description if lo.indicator else "",
                "outcome_text": lo.outcome_text,
                "assessment_tool": lo.assessment_tool,
            }
            for lo in rpd.learning_outcomes
        ],
        "literature": [
            {
                "source_type": l.source_type,
                "title": l.title,
                "authors": l.authors,
                "year": l.year,
                "publisher": l.publisher,
                "copies_count": l.copies_count,
            }
            for l in rpd.literature
        ],
        "software": [
            {
                "name": s.name,
                "license_type": s.license_type,
                "purpose": s.purpose,
            }
            for s in rpd.software
        ],
        "material_tech": [
            {"room_type": m.room_type, "equipment": m.equipment}
            for m in rpd.material_tech
        ],
    }

    pdf_bytes = generate_rpd_pdf(rpd_data)
    filename = f"RPD_{d.code or 'no_code'}_{d.name}_{rpd.academic_year}.pdf".replace("/", "_").replace(" ", "_")
    encoded_filename = quote(filename, safe="")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"},
    )
