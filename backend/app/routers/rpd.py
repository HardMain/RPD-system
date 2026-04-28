from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models import (
    User, Rpd, Discipline, Direction, RpdSection, RpdTopic,
    RpdLiterature, RpdSoftware, RpdMaterialTech, RpdDatabase, RpdLearningOutcome,
    RpdDeveloper, Notification, ApprovalStage, CompetencyIndicator, Competency,
    UploadedDocument, BupDiscipline, BupDisciplineCompetency, RpdBupDiscipline,
)
from app.schemas import (
    RpdCreate, RpdUpdate, RpdListOut, RpdDetailOut,
    RpdSectionCreate, RpdSectionOut, RpdTopicCreate, RpdTopicUpdate, RpdTopicOut,
    LiteratureCreate, LiteratureUpdate, LiteratureOut,
    SoftwareCreate, SoftwareOut,
    MaterialTechCreate, MaterialTechOut,
    DatabaseCreate, DatabaseOut,
    LearningOutcomeCreate, LearningOutcomeOut,
    DeveloperOut, ApprovalAction, ApprovalOut,
    DirectionOut, DisciplineOut, UploadedDocumentOut,
    OutcomeUpsert, OutcomeRowOut,
)

router = APIRouter(prefix="/api/rpd", tags=["rpd"])


# ── Helpers ──

def _representative_bup_disc(r: Rpd) -> BupDiscipline | None:
    """«Представительная» БУП-дисциплина для отображения часов/семестра в
    UI, который пока не знает про мульти-БУП. Берём первую."""
    for link in r.bup_links or []:
        if link.bup_discipline is not None:
            return link.bup_discipline
    return None


def _build_rpd_detail(r: Rpd) -> RpdDetailOut:
    d = r.discipline
    bd = _representative_bup_disc(r)
    outcomes = []
    for lo in r.learning_outcomes:
        ind = lo.indicator
        outcomes.append(LearningOutcomeOut(
            id_outcome=lo.id_outcome,
            id_indicator=lo.id_indicator,
            indicator_code=ind.code if ind else None,
            competency_code=ind.competency.code if ind and ind.competency else None,
            outcome_text=lo.outcome_text,
            assessment_tool=lo.assessment_tool,
        ))
    devs = [DeveloperOut(
        id_rpd_developer=dev.id_rpd_developer,
        id_user=dev.id_user,
        full_name=dev.user.full_name if dev.user else "",
    ) for dev in r.developers]
    approvals = [ApprovalOut(
        id_approval=a.id_approval,
        stage=a.stage,
        status=a.status,
        comment=a.comment,
        reviewer_name=a.reviewer.full_name if a.reviewer else None,
        reviewed_at=a.reviewed_at,
        created_at=a.created_at,
    ) for a in r.approvals]
    docs = [UploadedDocumentOut(
        id_document=doc.id_document,
        filename=doc.filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        uploaded_at=doc.uploaded_at,
    ) for doc in r.uploaded_documents]

    return RpdDetailOut(
        id_rpd=r.id_rpd, id_discipline=d.id_discipline,
        discipline_name=d.name,
        discipline_code=bd.code if bd else None,
        direction_name=d.direction.name, direction_code=d.direction.code,
        direction_profile=d.direction.profile,
        academic_year=r.academic_year,
        status=r.status, goals_text=r.goals_text, tasks_text=r.tasks_text,
        objects_text=r.objects_text, requirements_text=r.requirements_text,
        educational_tech=r.educational_tech, methodical_recommendations=r.methodical_recommendations,
        author_name=r.author.full_name,
        semester=bd.semester if bd else None,
        total_hours=bd.total_hours if bd else None,
        lecture_hours=bd.lecture_hours if bd else None,
        practice_hours=bd.practice_hours if bd else None,
        lab_hours=bd.lab_hours if bd else None,
        self_study_hours=bd.self_study_hours if bd else None,
        control_form=bd.control_form if bd else None,
        sections=[RpdSectionOut.model_validate(s) for s in r.sections],
        literature=[LiteratureOut.model_validate(l) for l in r.literature],
        software=[SoftwareOut.model_validate(s) for s in r.software],
        material_tech=[MaterialTechOut.model_validate(m) for m in r.material_tech],
        databases=[DatabaseOut.model_validate(d) for d in r.databases],
        learning_outcomes=outcomes,
        developers=devs,
        uploaded_documents=docs,
        approvals=approvals,
        created_at=r.created_at, updated_at=r.updated_at,
    )


def _rpd_select_options():
    return [
        selectinload(Rpd.discipline).selectinload(Discipline.direction),
        selectinload(Rpd.bup_links).selectinload(RpdBupDiscipline.bup_discipline),
        selectinload(Rpd.author),
        selectinload(Rpd.sections).selectinload(RpdSection.topics),
        selectinload(Rpd.literature),
        selectinload(Rpd.software),
        selectinload(Rpd.material_tech),
        selectinload(Rpd.databases),
        selectinload(Rpd.learning_outcomes).selectinload(RpdLearningOutcome.indicator).selectinload(CompetencyIndicator.competency),
        selectinload(Rpd.developers).selectinload(RpdDeveloper.user),
        selectinload(Rpd.uploaded_documents),
        selectinload(Rpd.approvals).selectinload(ApprovalStage.reviewer),
    ]


async def _get_rpd_full(rpd_id: int, db: AsyncSession) -> Rpd:
    result = await db.execute(
        select(Rpd).where(Rpd.id_rpd == rpd_id).options(*_rpd_select_options())
    )
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")
    return rpd


# ── Directions & Disciplines ──

@router.get("/directions", response_model=list[DirectionOut])
async def list_directions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Direction).order_by(Direction.code))
    return result.scalars().all()


@router.get("/disciplines", response_model=list[DisciplineOut])
async def list_disciplines(direction_id: int | None = None, db: AsyncSession = Depends(get_db)):
    """Список логических дисциплин с агрегатными часами «представительной»
    БУП-дисциплины (для совместимости с текущим UI)."""
    q = select(Discipline).join(Direction)
    if direction_id:
        q = q.where(Discipline.id_direction == direction_id)
    result = await db.execute(
        q.order_by(Discipline.name)
        .options(
            selectinload(Discipline.direction),
            selectinload(Discipline.bup_disciplines),
        )
    )
    rows = result.scalars().all()
    out: list[DisciplineOut] = []
    for d in rows:
        bd = d.bup_disciplines[0] if d.bup_disciplines else None
        out.append(DisciplineOut(
            id_discipline=d.id_discipline, id_direction=d.id_direction,
            name=d.name,
            code=bd.code if bd else None,
            semester=bd.semester if bd else None,
            total_hours=bd.total_hours if bd else None,
            lecture_hours=bd.lecture_hours if bd else None,
            practice_hours=bd.practice_hours if bd else None,
            lab_hours=bd.lab_hours if bd else None,
            self_study_hours=bd.self_study_hours if bd else None,
            control_form=bd.control_form if bd else None,
            direction_name=d.direction.name if d.direction else None,
            direction_code=d.direction.code if d.direction else None,
        ))
    return out


# ── RPD list ──

@router.get("/", response_model=list[RpdListOut])
async def list_rpds(
    status: str | None = None,
    academic_year: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = (
        select(Rpd)
        .options(
            selectinload(Rpd.discipline).selectinload(Discipline.direction),
            selectinload(Rpd.bup_links).selectinload(RpdBupDiscipline.bup_discipline),
            selectinload(Rpd.author),
        )
    )
    if user.role and user.role.name == "Преподаватель":
        q = q.where(Rpd.id_author == user.id_user)
    if status:
        q = q.where(Rpd.status == status)
    if academic_year:
        q = q.where(Rpd.academic_year == academic_year)
    q = q.order_by(Rpd.updated_at.desc())
    result = await db.execute(q)
    rows = result.scalars().all()
    out: list[RpdListOut] = []
    for r in rows:
        bd = _representative_bup_disc(r)
        out.append(RpdListOut(
            id_rpd=r.id_rpd,
            discipline_name=r.discipline.name,
            direction_name=r.discipline.direction.name,
            direction_code=r.discipline.direction.code,
            academic_year=r.academic_year,
            status=r.status,
            author_name=r.author.full_name,
            semester=bd.semester if bd else None,
            total_hours=bd.total_hours if bd else None,
            updated_at=r.updated_at,
        ))
    return out


# ── RPD detail ──

@router.get("/{rpd_id}", response_model=RpdDetailOut)
async def get_rpd(rpd_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rpd = await _get_rpd_full(rpd_id, db)
    return _build_rpd_detail(rpd)


# ── Create RPD ──

async def _attach_rpd_to_bup_disciplines(
    rpd: Rpd, db: AsyncSession, *, bup_discipline_ids: list[int] | None = None,
) -> None:
    """Привязать РПД к BupDiscipline.

    Если передан явный `bup_discipline_ids` — используем его. Иначе берём все
    BupDiscipline той же логической дисциплины (поведение АРМ-fallback).
    """
    if bup_discipline_ids:
        rows = await db.execute(
            select(BupDiscipline).where(BupDiscipline.id_bup_discipline.in_(bup_discipline_ids))
        )
    else:
        rows = await db.execute(
            select(BupDiscipline).where(BupDiscipline.id_discipline == rpd.id_discipline)
        )
    for bd in rows.scalars().all():
        db.add(RpdBupDiscipline(id_rpd=rpd.id_rpd, id_bup_discipline=bd.id_bup_discipline))


async def _autofill_outcomes_from_bup_disciplines(
    rpd: Rpd, bd_ids: list[int], db: AsyncSession,
) -> None:
    """Создать пустые `RpdLearningOutcome` для каждого индикатора компетенций
    выбранных BupDiscipline (как в АРМ — таблица сразу появляется заполненной
    индикаторами, текст и средство оценки преподаватель вписывает сам)."""
    if not bd_ids:
        return
    res = await db.execute(
        select(CompetencyIndicator)
        .join(Competency, Competency.id_competency == CompetencyIndicator.id_competency)
        .join(BupDisciplineCompetency, BupDisciplineCompetency.id_competency == Competency.id_competency)
        .where(BupDisciplineCompetency.id_bup_discipline.in_(bd_ids))
        .distinct()
    )
    for ind in res.scalars().all():
        db.add(RpdLearningOutcome(
            id_rpd=rpd.id_rpd, id_indicator=ind.id_indicator,
            outcome_text=None, assessment_tool=None,
        ))


@router.post("/", response_model=RpdDetailOut, status_code=201)
async def create_rpd(data: RpdCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    # Если переданы bup_discipline_ids, нужно вытащить id_discipline из первой БУП-дисциплины
    id_discipline = data.id_discipline
    if data.bup_discipline_ids:
        first_bd = await db.execute(
            select(BupDiscipline)
            .where(BupDiscipline.id_bup_discipline == data.bup_discipline_ids[0])
        )
        bd = first_bd.scalar_one_or_none()
        if not bd:
            raise HTTPException(status_code=400, detail="БУП-дисциплина не найдена")
        id_discipline = bd.id_discipline
    if not id_discipline:
        raise HTTPException(status_code=400, detail="Не указана дисциплина или БУП-дисциплины")

    rpd = Rpd(
        id_discipline=id_discipline,
        id_author=user.id_user,
        academic_year=data.academic_year,
        status="Черновик",
        based_on_rpd_id=data.based_on_rpd_id,
    )
    # If based on archive, copy text fields and sections
    if data.based_on_rpd_id:
        base_result = await db.execute(
            select(Rpd).where(Rpd.id_rpd == data.based_on_rpd_id)
            .options(
                selectinload(Rpd.sections).selectinload(RpdSection.topics),
                selectinload(Rpd.literature),
                selectinload(Rpd.software),
                selectinload(Rpd.material_tech),
                selectinload(Rpd.learning_outcomes),
            )
        )
        base = base_result.scalar_one_or_none()
        if base:
            for field in ["goals_text", "tasks_text", "objects_text", "requirements_text",
                          "educational_tech", "methodical_recommendations"]:
                setattr(rpd, field, getattr(base, field))
            db.add(rpd)
            await db.flush()

            # Copy sections and topics
            for s in base.sections:
                new_sec = RpdSection(
                    id_rpd=rpd.id_rpd, section_number=s.section_number,
                    title=s.title, brief_content=s.brief_content,
                    lecture_hours=s.lecture_hours, practice_hours=s.practice_hours,
                    lab_hours=s.lab_hours, self_study_hours=s.self_study_hours,
                )
                db.add(new_sec)
                await db.flush()
                for t in s.topics:
                    db.add(RpdTopic(
                        id_section=new_sec.id_section, topic_type=t.topic_type,
                        title=t.title, hours=t.hours, description=t.description,
                    ))

            # Copy literature
            for lit in base.literature:
                db.add(RpdLiterature(
                    id_rpd=rpd.id_rpd, source_type=lit.source_type,
                    title=lit.title, authors=lit.authors, year=lit.year,
                    publisher=lit.publisher, url=lit.url, copies_count=lit.copies_count,
                ))

            # Copy software
            for sw in base.software:
                db.add(RpdSoftware(
                    id_rpd=rpd.id_rpd, name=sw.name,
                    license_type=sw.license_type, purpose=sw.purpose,
                ))

            # Copy material tech
            for mt in base.material_tech:
                db.add(RpdMaterialTech(
                    id_rpd=rpd.id_rpd, room_type=mt.room_type, equipment=mt.equipment,
                ))

            # Copy learning outcomes
            for lo in base.learning_outcomes:
                db.add(RpdLearningOutcome(
                    id_rpd=rpd.id_rpd, id_indicator=lo.id_indicator,
                    outcome_text=lo.outcome_text, assessment_tool=lo.assessment_tool,
                ))
        else:
            db.add(rpd)
            await db.flush()
    else:
        db.add(rpd)
        await db.flush()

    await _attach_rpd_to_bup_disciplines(rpd, db, bup_discipline_ids=data.bup_discipline_ids or None)

    # Если выбран явный список БУП-дисциплин — авто-наполняем outcomes индикаторами
    # из их компетенций. Это полностью соответствует АРМ: после выбора дисциплины
    # БУП в разделе «Планируемые результаты» уже есть таблица индикаторов.
    if data.bup_discipline_ids and not data.based_on_rpd_id:
        await _autofill_outcomes_from_bup_disciplines(rpd, data.bup_discipline_ids, db)

    await db.commit()
    rpd_full = await _get_rpd_full(rpd.id_rpd, db)
    return _build_rpd_detail(rpd_full)


# ── Update RPD text fields ──

@router.patch("/{rpd_id}", response_model=RpdDetailOut)
async def update_rpd(rpd_id: int, data: RpdUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Rpd).where(Rpd.id_rpd == rpd_id))
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rpd, field, value)
    await db.commit()
    rpd_full = await _get_rpd_full(rpd_id, db)
    return _build_rpd_detail(rpd_full)


# ── Delete RPD ──

@router.delete("/{rpd_id}", status_code=204)
async def delete_rpd(rpd_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Rpd).where(Rpd.id_rpd == rpd_id))
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")
    if rpd.id_author != user.id_user and user.role.name not in ("Администратор",):
        raise HTTPException(status_code=403, detail="Нет прав на удаление")
    if rpd.status not in ("Черновик",):
        raise HTTPException(status_code=400, detail="Удалить можно только черновик")
    await db.delete(rpd)
    await db.commit()


# ── Sections ──

@router.post("/{rpd_id}/sections", response_model=RpdSectionOut, status_code=201)
async def add_section(rpd_id: int, data: RpdSectionCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    section = RpdSection(id_rpd=rpd_id, **data.model_dump())
    db.add(section)
    await db.commit()
    await db.refresh(section, attribute_names=["topics"])
    return section


@router.put("/sections/{section_id}", response_model=RpdSectionOut)
async def update_section(section_id: int, data: RpdSectionCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(RpdSection).where(RpdSection.id_section == section_id)
        .options(selectinload(RpdSection.topics))
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump().items():
        setattr(section, k, v)
    await db.commit()
    await db.refresh(section, attribute_names=["topics"])
    return section


@router.delete("/sections/{section_id}", status_code=204)
async def delete_section(section_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdSection).where(RpdSection.id_section == section_id))
    section = result.scalar_one_or_none()
    if section:
        await db.delete(section)
        await db.commit()


# ── Topics ──

@router.post("/sections/{section_id}/topics", response_model=RpdTopicOut, status_code=201)
async def add_topic(section_id: int, data: RpdTopicCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    topic = RpdTopic(id_section=section_id, **data.model_dump())
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.put("/topics/{topic_id}", response_model=RpdTopicOut)
async def update_topic(topic_id: int, data: RpdTopicUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdTopic).where(RpdTopic.id_topic == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(topic, k, v)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete("/topics/{topic_id}", status_code=204)
async def delete_topic(topic_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdTopic).where(RpdTopic.id_topic == topic_id))
    topic = result.scalar_one_or_none()
    if topic:
        await db.delete(topic)
        await db.commit()


# ── Literature ──

@router.post("/{rpd_id}/literature", response_model=LiteratureOut, status_code=201)
async def add_literature(rpd_id: int, data: LiteratureCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    lit = RpdLiterature(id_rpd=rpd_id, **data.model_dump())
    db.add(lit)
    await db.commit()
    await db.refresh(lit)
    return lit


@router.put("/literature/{lit_id}", response_model=LiteratureOut)
async def update_literature(lit_id: int, data: LiteratureUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdLiterature).where(RpdLiterature.id_literature == lit_id))
    lit = result.scalar_one_or_none()
    if not lit:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(lit, k, v)
    await db.commit()
    await db.refresh(lit)
    return lit


@router.delete("/literature/{lit_id}", status_code=204)
async def delete_literature(lit_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdLiterature).where(RpdLiterature.id_literature == lit_id))
    lit = result.scalar_one_or_none()
    if lit:
        await db.delete(lit)
        await db.commit()


# ── Software ──

@router.post("/{rpd_id}/software", response_model=SoftwareOut, status_code=201)
async def add_software(rpd_id: int, data: SoftwareCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    sw = RpdSoftware(id_rpd=rpd_id, **data.model_dump())
    db.add(sw)
    await db.commit()
    await db.refresh(sw)
    return sw


@router.put("/software/{sw_id}", response_model=SoftwareOut)
async def update_software(sw_id: int, data: SoftwareCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdSoftware).where(RpdSoftware.id_software == sw_id))
    sw = result.scalar_one_or_none()
    if not sw:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump().items():
        setattr(sw, k, v)
    await db.commit()
    await db.refresh(sw)
    return sw


@router.delete("/software/{sw_id}", status_code=204)
async def delete_software(sw_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdSoftware).where(RpdSoftware.id_software == sw_id))
    sw = result.scalar_one_or_none()
    if sw:
        await db.delete(sw)
        await db.commit()


# ── Material-Tech ──

@router.post("/{rpd_id}/material-tech", response_model=MaterialTechOut, status_code=201)
async def add_material_tech(rpd_id: int, data: MaterialTechCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    mt = RpdMaterialTech(id_rpd=rpd_id, **data.model_dump())
    db.add(mt)
    await db.commit()
    await db.refresh(mt)
    return mt


@router.put("/material-tech/{mt_id}", response_model=MaterialTechOut)
async def update_material_tech(mt_id: int, data: MaterialTechCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdMaterialTech).where(RpdMaterialTech.id_material_tech == mt_id))
    mt = result.scalar_one_or_none()
    if not mt:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump().items():
        setattr(mt, k, v)
    await db.commit()
    await db.refresh(mt)
    return mt


@router.delete("/material-tech/{mt_id}", status_code=204)
async def delete_material_tech(mt_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdMaterialTech).where(RpdMaterialTech.id_material_tech == mt_id))
    mt = result.scalar_one_or_none()
    if mt:
        await db.delete(mt)
        await db.commit()


# ── Databases (БД и ИСС) ──

@router.post("/{rpd_id}/databases", response_model=DatabaseOut, status_code=201)
async def add_database(rpd_id: int, data: DatabaseCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    item = RpdDatabase(id_rpd=rpd_id, **data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/databases/{db_id}", response_model=DatabaseOut)
async def update_database(db_id: int, data: DatabaseCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdDatabase).where(RpdDatabase.id_database == db_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump().items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/databases/{db_id}", status_code=204)
async def delete_database(db_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdDatabase).where(RpdDatabase.id_database == db_id))
    item = result.scalar_one_or_none()
    if item:
        await db.delete(item)
        await db.commit()


# ── Learning Outcomes ──

@router.post("/{rpd_id}/outcomes", response_model=LearningOutcomeOut, status_code=201)
async def add_outcome(rpd_id: int, data: LearningOutcomeCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    lo = RpdLearningOutcome(id_rpd=rpd_id, **data.model_dump())
    db.add(lo)
    await db.commit()
    await db.refresh(lo)
    # Load indicator and competency
    result = await db.execute(
        select(RpdLearningOutcome).where(RpdLearningOutcome.id_outcome == lo.id_outcome)
        .options(selectinload(RpdLearningOutcome.indicator).selectinload(CompetencyIndicator.competency))
    )
    lo = result.scalar_one()
    ind = lo.indicator
    return LearningOutcomeOut(
        id_outcome=lo.id_outcome, id_indicator=lo.id_indicator,
        indicator_code=ind.code if ind else None,
        competency_code=ind.competency.code if ind and ind.competency else None,
        outcome_text=lo.outcome_text, assessment_tool=lo.assessment_tool,
    )


@router.put("/outcomes/{outcome_id}", response_model=LearningOutcomeOut)
async def update_outcome(outcome_id: int, data: LearningOutcomeCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(RpdLearningOutcome).where(RpdLearningOutcome.id_outcome == outcome_id)
        .options(selectinload(RpdLearningOutcome.indicator).selectinload(CompetencyIndicator.competency))
    )
    lo = result.scalar_one_or_none()
    if not lo:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump().items():
        setattr(lo, k, v)
    await db.commit()
    await db.refresh(lo)
    # Re-load
    result = await db.execute(
        select(RpdLearningOutcome).where(RpdLearningOutcome.id_outcome == lo.id_outcome)
        .options(selectinload(RpdLearningOutcome.indicator).selectinload(CompetencyIndicator.competency))
    )
    lo = result.scalar_one()
    ind = lo.indicator
    return LearningOutcomeOut(
        id_outcome=lo.id_outcome, id_indicator=lo.id_indicator,
        indicator_code=ind.code if ind else None,
        competency_code=ind.competency.code if ind and ind.competency else None,
        outcome_text=lo.outcome_text, assessment_tool=lo.assessment_tool,
    )


@router.delete("/outcomes/{outcome_id}", status_code=204)
async def delete_outcome(outcome_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdLearningOutcome).where(RpdLearningOutcome.id_outcome == outcome_id))
    lo = result.scalar_one_or_none()
    if lo:
        await db.delete(lo)
        await db.commit()


@router.get("/{rpd_id}/outcomes-table", response_model=list[OutcomeRowOut])
async def get_outcomes_table(
    rpd_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Вернуть полную таблицу планируемых результатов:
    все индикаторы из компетенций БУП-дисциплин этой РПД + текущий заполненный
    текст и средство оценки (если есть)."""
    rpd_res = await db.execute(
        select(Rpd).where(Rpd.id_rpd == rpd_id)
        .options(
            selectinload(Rpd.bup_links).selectinload(RpdBupDiscipline.bup_discipline),
            selectinload(Rpd.learning_outcomes),
        )
    )
    rpd = rpd_res.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404)

    bd_ids = [link.id_bup_discipline for link in rpd.bup_links]
    if not bd_ids:
        return []

    inds_res = await db.execute(
        select(CompetencyIndicator, Competency)
        .join(Competency, Competency.id_competency == CompetencyIndicator.id_competency)
        .join(BupDisciplineCompetency, BupDisciplineCompetency.id_competency == Competency.id_competency)
        .where(BupDisciplineCompetency.id_bup_discipline.in_(bd_ids))
        .order_by(Competency.code, CompetencyIndicator.code)
    )
    seen: set[int] = set()
    outcome_by_ind = {lo.id_indicator: lo for lo in rpd.learning_outcomes}
    rows: list[OutcomeRowOut] = []
    for ind, comp in inds_res.all():
        if ind.id_indicator in seen:
            continue
        seen.add(ind.id_indicator)
        lo = outcome_by_ind.get(ind.id_indicator)
        rows.append(OutcomeRowOut(
            id_indicator=ind.id_indicator,
            indicator_code=ind.code,
            indicator_description=ind.description,
            competency_code=comp.code,
            competency_name=comp.name,
            id_outcome=lo.id_outcome if lo else None,
            outcome_text=lo.outcome_text if lo else None,
            assessment_tool=lo.assessment_tool if lo else None,
        ))
    return rows


@router.post("/{rpd_id}/outcomes/upsert", response_model=LearningOutcomeOut)
async def upsert_outcome(
    rpd_id: int,
    data: OutcomeUpsert,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Создать/обновить запись планируемого результата по `id_indicator`.

    Если оба поля (текст и средство) пустые и запись существует — удаляет её.
    """
    res = await db.execute(
        select(RpdLearningOutcome)
        .where(RpdLearningOutcome.id_rpd == rpd_id)
        .where(RpdLearningOutcome.id_indicator == data.id_indicator)
        .options(selectinload(RpdLearningOutcome.indicator).selectinload(CompetencyIndicator.competency))
    )
    lo = res.scalar_one_or_none()
    text = (data.outcome_text or "").strip()
    tool = (data.assessment_tool or "").strip()

    if lo:
        if not text and not tool:
            await db.delete(lo)
            await db.commit()
            return LearningOutcomeOut(
                id_outcome=0, id_indicator=data.id_indicator,
                indicator_code=None, competency_code=None,
                outcome_text=None, assessment_tool=None,
            )
        lo.outcome_text = text or None
        lo.assessment_tool = tool or None
    else:
        if not text and not tool:
            return LearningOutcomeOut(
                id_outcome=0, id_indicator=data.id_indicator,
                indicator_code=None, competency_code=None,
                outcome_text=None, assessment_tool=None,
            )
        lo = RpdLearningOutcome(
            id_rpd=rpd_id, id_indicator=data.id_indicator,
            outcome_text=text or None, assessment_tool=tool or None,
        )
        db.add(lo)
    await db.commit()

    # Reload with indicator+competency
    res = await db.execute(
        select(RpdLearningOutcome).where(RpdLearningOutcome.id_outcome == lo.id_outcome)
        .options(selectinload(RpdLearningOutcome.indicator).selectinload(CompetencyIndicator.competency))
    )
    lo = res.scalar_one()
    ind = lo.indicator
    return LearningOutcomeOut(
        id_outcome=lo.id_outcome, id_indicator=lo.id_indicator,
        indicator_code=ind.code if ind else None,
        competency_code=ind.competency.code if ind and ind.competency else None,
        outcome_text=lo.outcome_text, assessment_tool=lo.assessment_tool,
    )


# ── Developers ──

@router.post("/{rpd_id}/developers", response_model=DeveloperOut, status_code=201)
async def add_developer(rpd_id: int, user_id: int = Query(...), db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    dev = RpdDeveloper(id_rpd=rpd_id, id_user=user_id)
    db.add(dev)
    await db.commit()
    await db.refresh(dev)
    result = await db.execute(
        select(RpdDeveloper).where(RpdDeveloper.id_rpd_developer == dev.id_rpd_developer)
        .options(selectinload(RpdDeveloper.user))
    )
    dev = result.scalar_one()
    return DeveloperOut(id_rpd_developer=dev.id_rpd_developer, id_user=dev.id_user, full_name=dev.user.full_name)


@router.delete("/developers/{dev_id}", status_code=204)
async def remove_developer(dev_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdDeveloper).where(RpdDeveloper.id_rpd_developer == dev_id))
    dev = result.scalar_one_or_none()
    if dev:
        await db.delete(dev)
        await db.commit()


# ── Send for approval ──

@router.post("/{rpd_id}/send-approval", status_code=200)
async def send_for_approval(rpd_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Rpd).where(Rpd.id_rpd == rpd_id))
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404)
    if rpd.status not in ("Черновик", "На доработке"):
        raise HTTPException(status_code=400, detail="РПД не может быть отправлена на согласование в текущем статусе")
    rpd.status = "На согласовании"
    approval = ApprovalStage(
        id_rpd=rpd_id, id_reviewer=user.id_user,
        stage="Зав. кафедрой", status="Ожидание",
    )
    db.add(approval)

    # Notify head of department
    notif = Notification(
        id_user=user.id_user, id_rpd=rpd_id,
        message=f"РПД отправлена на согласование",
    )
    db.add(notif)
    await db.commit()
    return {"detail": "РПД отправлена на согласование"}


# ── Approve / Reject ──

@router.post("/{rpd_id}/review")
async def review_rpd(rpd_id: int, data: ApprovalAction, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Rpd).where(Rpd.id_rpd == rpd_id))
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404)

    if data.action == "approve":
        rpd.status = "Согласовано"
    elif data.action == "reject":
        rpd.status = "На доработке"
    else:
        raise HTTPException(status_code=400, detail="Неизвестное действие")

    approval = ApprovalStage(
        id_rpd=rpd_id, id_reviewer=user.id_user,
        stage="Зав. кафедрой",
        status="Согласовано" if data.action == "approve" else "Отклонено",
        comment=data.comment,
        reviewed_at=datetime.now(timezone.utc),
    )
    db.add(approval)

    status_text = "согласована" if data.action == "approve" else "возвращена на доработку"
    msg = f"РПД {status_text}"
    if data.comment:
        msg += f": {data.comment}"
    notif = Notification(id_user=rpd.id_author, id_rpd=rpd_id, message=msg)
    db.add(notif)
    await db.commit()
    return {"detail": f"РПД {rpd.status}"}


# ── Approval history ──

@router.get("/{rpd_id}/approvals", response_model=list[ApprovalOut])
async def get_approvals(rpd_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(ApprovalStage).where(ApprovalStage.id_rpd == rpd_id)
        .options(selectinload(ApprovalStage.reviewer))
        .order_by(ApprovalStage.created_at.desc())
    )
    rows = result.scalars().all()
    return [
        ApprovalOut(
            id_approval=a.id_approval, stage=a.stage, status=a.status,
            comment=a.comment,
            reviewer_name=a.reviewer.full_name if a.reviewer else None,
            reviewed_at=a.reviewed_at, created_at=a.created_at,
        ) for a in rows
    ]
