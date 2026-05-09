from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user, user_can
from app.models import (
    User, Rpd, Discipline, Direction, RpdSection, RpdTopic,
    RpdLiterature, RpdSoftware, RpdMaterialTech, RpdDatabase, RpdLearningOutcome,
    RpdDeveloper, Notification, ApprovalStage, CompetencyIndicator, Competency,
    UploadedDocument, BupDiscipline, BupDisciplineCompetency, RpdBupDiscipline,
    RpdFosFile, RpdApprovalRoute, Role, RolePermission, Permission,
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
    ApprovalRouteStepOut, ApprovalRouteUpdate, ReviewerCandidateOut,
    DirectionOut, DisciplineOut, UploadedDocumentOut,
    OutcomeUpsert, OutcomeRowOut, BupDisciplineRefOut, FosFileOut,
    ManualLinkUpdate, ManualOutcomeCreate,
)
from app.models import Bup

router = APIRouter(prefix="/api/rpd", tags=["rpd"])

def _representative_link(r: Rpd):
    for link in r.bup_links or []:
        return link
    return None

def _build_rpd_detail(r: Rpd) -> RpdDetailOut:
    d = r.discipline
    rep_link = _representative_link(r)
    rep_bd = rep_link.bup_discipline if rep_link else None
    outcomes = []
    for lo in r.learning_outcomes:
        ind = lo.indicator
        outcomes.append(LearningOutcomeOut(
            id_outcome=lo.id_outcome,
            id_indicator=lo.id_indicator,
            indicator_code=lo.indicator_code or (ind.code if ind else None),
            competency_code=lo.competency_code or (ind.competency.code if ind and ind.competency else None),
            outcome_text=lo.outcome_text,
            assessment_tool=lo.assessment_tool,
        ))
    devs = [DeveloperOut(
        id_rpd_developer=dev.id_rpd_developer,
        id_user=dev.id_user,
        full_name=dev.user.full_name if dev.user else "",
        title=dev.user.title if dev.user else None,
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
    route = [ApprovalRouteStepOut(
        id_route=s.id_route,
        step_order=s.step_order,
        id_reviewer=s.id_reviewer,
        reviewer_name=s.reviewer.full_name if s.reviewer else "",
        reviewer_title=s.reviewer.title if s.reviewer else None,
        status=s.status,
        comment=s.comment,
        reviewed_at=s.reviewed_at,
    ) for s in (r.approval_route or [])]

    def _pick(link_value, fk_value):
        return link_value if link_value not in (None, "") else fk_value

    def _bd_ref(link) -> BupDisciplineRefOut:
        bd = link.bup_discipline
        bup = bd.bup if bd else None
        direc = bup.direction if bup else None
        fgos = direc.fgos_file if direc and direc.fgos_file else None
        return BupDisciplineRefOut(
            id_bup_discipline=bd.id_bup_discipline if bd else None,
            id_bup=bd.id_bup if bd else None,
            bup_name=_pick(link.bup_name, bup.name if bup else ""),
            code=_pick(link.code, bd.code if bd else None),
            semester=_pick(link.semester, bd.semester if bd else None),
            control_form=_pick(link.control_form, bd.control_form if bd else None),
            total_hours=_pick(link.total_hours, bd.total_hours if bd else None),
            exam_hours=_pick(link.exam_hours, bd.exam_hours if bd else None),
            lecture_hours=_pick(link.lecture_hours, bd.lecture_hours if bd else None),
            lab_hours=_pick(link.lab_hours, bd.lab_hours if bd else None),
            practice_hours=_pick(link.practice_hours, bd.practice_hours if bd else None),
            ksr_hours=_pick(link.ksr_hours, bd.ksr_hours if bd else None),
            self_study_hours=_pick(link.self_study_hours, bd.self_study_hours if bd else None),
            zet=_pick(link.zet, bd.zet if bd else None),
            direction_code=_pick(link.direction_code, direc.code if direc else None),
            direction_name=_pick(link.direction_name, direc.name if direc else None),
            direction_profile=_pick(link.direction_profile, direc.profile if direc else None),
            fgos_file_id=_pick(link.fgos_file_id, fgos.id_file if fgos else None),
            fgos_file_name=_pick(link.fgos_file_name, fgos.original_name if fgos else None),
            semesters_data=_pick(link.semesters_data, bd.semesters_data if bd else None),
            form_of_study=_pick(link.form_of_study, bup.form_of_study if bup else None),
            bup_deleted=bd is None and not link.is_manual,
            is_manual=link.is_manual,
        )
    bup_disciplines = [_bd_ref(link) for link in (r.bup_links or [])]

    def _fos_out(link) -> FosFileOut:
        sf = link.file
        return FosFileOut(
            id_rpd_fos=link.id_rpd_fos, id_file=link.id_file, role=link.role,
            name=link.name, comment=link.comment,
            original_name=sf.original_name if sf else "",
            size_bytes=sf.size_bytes if sf else None,
        )
    fos_main = next((_fos_out(f) for f in (r.fos_files or []) if f.role == "main"), None)
    fos_other = [_fos_out(f) for f in (r.fos_files or []) if f.role == "other"]

    rep_bup = rep_bd.bup if rep_bd else None
    rep_dir = rep_bup.direction if rep_bup else None
    rep_link_pick = lambda val, fk: val if val not in (None, "") else fk
    return RpdDetailOut(
        id_rpd=r.id_rpd, id_discipline=d.id_discipline,
        discipline_name=d.name,
        discipline_code=rep_link_pick(rep_link.code if rep_link else None, rep_bd.code if rep_bd else None),
        direction_name=rep_link_pick(rep_link.direction_name if rep_link else None, rep_dir.name if rep_dir else "") or "",
        direction_code=rep_link_pick(rep_link.direction_code if rep_link else None, rep_dir.code if rep_dir else "") or "",
        direction_profile=rep_link_pick(rep_link.direction_profile if rep_link else None, rep_bup.profile if rep_bup else None),
        academic_year=r.academic_year,
        status=r.status, goals_text=r.goals_text, tasks_text=r.tasks_text,
        objects_text=r.objects_text, requirements_text=r.requirements_text,
        educational_tech=r.educational_tech, methodical_recommendations=r.methodical_recommendations,
        comment=r.comment,
        author_name=r.author.full_name,
        id_author=r.id_author,
        semester=rep_link_pick(rep_link.semester if rep_link else None, rep_bd.semester if rep_bd else None),
        total_hours=rep_link_pick(rep_link.total_hours if rep_link else None, rep_bd.total_hours if rep_bd else None),
        lecture_hours=rep_link_pick(rep_link.lecture_hours if rep_link else None, rep_bd.lecture_hours if rep_bd else None),
        practice_hours=rep_link_pick(rep_link.practice_hours if rep_link else None, rep_bd.practice_hours if rep_bd else None),
        lab_hours=rep_link_pick(rep_link.lab_hours if rep_link else None, rep_bd.lab_hours if rep_bd else None),
        self_study_hours=rep_link_pick(rep_link.self_study_hours if rep_link else None, rep_bd.self_study_hours if rep_bd else None),
        control_form=rep_link_pick(rep_link.control_form if rep_link else None, rep_bd.control_form if rep_bd else None),
        bup_disciplines=bup_disciplines,
        fos_main=fos_main,
        fos_other=fos_other,
        sections=[RpdSectionOut.model_validate(s) for s in r.sections],
        topics=[RpdTopicOut.model_validate(t) for t in r.topics],
        literature=[LiteratureOut.model_validate(l) for l in r.literature],
        software=[SoftwareOut.model_validate(s) for s in r.software],
        material_tech=[MaterialTechOut.model_validate(m) for m in r.material_tech],
        databases=[DatabaseOut.model_validate(d) for d in r.databases],
        learning_outcomes=outcomes,
        developers=devs,
        uploaded_documents=docs,
        approvals=approvals,
        approval_route=route,
        created_at=r.created_at, updated_at=r.updated_at,
    )

def _rpd_select_options():
    return [
        selectinload(Rpd.discipline),
        selectinload(Rpd.bup_links)
            .selectinload(RpdBupDiscipline.bup_discipline)
            .selectinload(BupDiscipline.bup)
            .selectinload(Bup.direction)
            .selectinload(Direction.fgos_file),
        selectinload(Rpd.author),
        selectinload(Rpd.sections),
        selectinload(Rpd.topics),
        selectinload(Rpd.literature),
        selectinload(Rpd.software),
        selectinload(Rpd.material_tech),
        selectinload(Rpd.databases),
        selectinload(Rpd.learning_outcomes).selectinload(RpdLearningOutcome.indicator).selectinload(CompetencyIndicator.competency),
        selectinload(Rpd.developers).selectinload(RpdDeveloper.user),
        selectinload(Rpd.fos_files).selectinload(RpdFosFile.file),
        selectinload(Rpd.uploaded_documents),
        selectinload(Rpd.approvals).selectinload(ApprovalStage.reviewer),
        selectinload(Rpd.approval_route).selectinload(RpdApprovalRoute.reviewer),
    ]

async def _get_rpd_full(rpd_id: int, db: AsyncSession) -> Rpd:
    result = await db.execute(
        select(Rpd).where(Rpd.id_rpd == rpd_id).options(*_rpd_select_options())
    )
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")
    return rpd

@router.get("/directions", response_model=list[DirectionOut])
async def list_directions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Direction).order_by(Direction.code))
    return result.scalars().all()

@router.get("/disciplines", response_model=list[DisciplineOut])
async def list_disciplines(
    include_unbound: bool = False,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Discipline)
        .order_by(Discipline.name)
        .options(selectinload(Discipline.bup_disciplines))
    )
    rows = result.scalars().all()
    out: list[DisciplineOut] = []
    for d in rows:
        if not d.bup_disciplines:
            if not include_unbound:
                continue
            out.append(DisciplineOut(
                id_discipline=d.id_discipline,
                name=d.name,
                code=None, semester=None,
                total_hours=None, lecture_hours=None,
                practice_hours=None, lab_hours=None,
                self_study_hours=None, control_form=None,
            ))
            continue
        bd = d.bup_disciplines[0]
        out.append(DisciplineOut(
            id_discipline=d.id_discipline,
            name=d.name,
            code=bd.code if bd else None,
            semester=bd.semester if bd else None,
            total_hours=bd.total_hours if bd else None,
            lecture_hours=bd.lecture_hours if bd else None,
            practice_hours=bd.practice_hours if bd else None,
            lab_hours=bd.lab_hours if bd else None,
            self_study_hours=bd.self_study_hours if bd else None,
            control_form=bd.control_form if bd else None,
        ))
    return out

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
            selectinload(Rpd.discipline),
            selectinload(Rpd.bup_links)
                .selectinload(RpdBupDiscipline.bup_discipline)
                .selectinload(BupDiscipline.bup)
                .selectinload(Bup.direction),
            selectinload(Rpd.author),
            selectinload(Rpd.developers).selectinload(RpdDeveloper.user),
            selectinload(Rpd.approval_route),
        )
    )
    if status:
        q = q.where(Rpd.status == status)
    if academic_year:
        q = q.where(Rpd.academic_year == academic_year)
    q = q.order_by(Rpd.updated_at.desc())
    result = await db.execute(q)
    rows = result.scalars().all()
    out: list[RpdListOut] = []
    for r in rows:
        link = _representative_link(r)
        bd = link.bup_discipline if link else None
        rep_dir = bd.bup.direction if bd and bd.bup else None
        pick = lambda val, fk: val if val not in (None, "") else fk
        current_step = next((s for s in (r.approval_route or []) if s.status == "pending"), None)
        out.append(RpdListOut(
            id_rpd=r.id_rpd,
            discipline_name=r.discipline.name,
            direction_name=pick(link.direction_name if link else None, rep_dir.name if rep_dir else "") or "",
            direction_code=pick(link.direction_code if link else None, rep_dir.code if rep_dir else "") or "",
            academic_year=r.academic_year,
            status=r.status,
            author_name=r.author.full_name,
            semester=pick(link.semester if link else None, bd.semester if bd else None),
            total_hours=pick(link.total_hours if link else None, bd.total_hours if bd else None),
            updated_at=r.updated_at,
            comment=r.comment,
            developer_names=[dev.user.full_name for dev in (r.developers or []) if dev.user],
            current_reviewer_id=current_step.id_reviewer if current_step else None,
        ))
    return out

@router.get("/reviewers", response_model=list[ReviewerCandidateOut])
async def list_reviewer_candidates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    res = await db.execute(
        select(User)
        .join(User.role).join(Role.permissions).join(RolePermission.permission)
        .where(User.is_active == True)
        .where(Permission.code == "rpd.approve")
        .options(selectinload(User.role), selectinload(User.department))
        .order_by(User.full_name)
        .distinct()
    )
    return [
        ReviewerCandidateOut(
            id_user=u.id_user, full_name=u.full_name, title=u.title,
            role=u.role.name if u.role else "",
            department=u.department.name if u.department else "",
        )
        for u in res.scalars().all()
    ]

@router.get("/{rpd_id}", response_model=RpdDetailOut)
async def get_rpd(rpd_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rpd = await _get_rpd_full(rpd_id, db)
    return _build_rpd_detail(rpd)

def _fill_rpd_bup_disc_snapshot(link: RpdBupDiscipline, bd: BupDiscipline) -> None:
    bup = bd.bup
    direc = bup.direction if bup else None
    fgos = direc.fgos_file if direc and direc.fgos_file else None
    link.bup_name = bup.name if bup else None
    link.bup_year = bup.year if bup else None
    link.bup_profile = bup.profile if bup else None
    link.direction_code = direc.code if direc else None
    link.direction_name = direc.name if direc else None
    link.direction_profile = direc.profile if direc else None
    link.fgos_file_id = fgos.id_file if fgos else None
    link.fgos_file_name = fgos.original_name if fgos else None
    link.code = bd.code
    link.semester = bd.semester
    link.control_form = bd.control_form
    link.total_hours = bd.total_hours
    link.exam_hours = bd.exam_hours
    link.lecture_hours = bd.lecture_hours
    link.lab_hours = bd.lab_hours
    link.practice_hours = bd.practice_hours
    link.ksr_hours = bd.ksr_hours
    link.self_study_hours = bd.self_study_hours
    link.zet = bd.zet
    link.semesters_data = bd.semesters_data
    link.discipline_name = bd.discipline.name if bd.discipline else None
    link.form_of_study = bup.form_of_study if bup else None

def _fill_outcome_snapshot(lo: RpdLearningOutcome, ind: CompetencyIndicator) -> None:
    comp = ind.competency if ind else None
    lo.indicator_code = ind.code if ind else None
    lo.indicator_description = ind.description if ind else None
    lo.competency_code = comp.code if comp else None
    lo.competency_name = comp.name if comp else None

async def _attach_rpd_to_bup_disciplines(
    rpd: Rpd, db: AsyncSession, *, bup_discipline_ids: list[int] | None = None,
) -> None:
    options = (
        selectinload(BupDiscipline.discipline),
        selectinload(BupDiscipline.bup).selectinload(Bup.direction).selectinload(Direction.fgos_file),
    )
    if bup_discipline_ids:
        rows = await db.execute(
            select(BupDiscipline)
            .where(BupDiscipline.id_bup_discipline.in_(bup_discipline_ids))
            .options(*options)
        )
    else:
        rows = await db.execute(
            select(BupDiscipline)
            .where(BupDiscipline.id_discipline == rpd.id_discipline)
            .options(*options)
        )
    for bd in rows.scalars().all():
        link = RpdBupDiscipline(id_rpd=rpd.id_rpd, id_bup_discipline=bd.id_bup_discipline)
        _fill_rpd_bup_disc_snapshot(link, bd)
        db.add(link)

async def _autofill_outcomes_from_bup_disciplines(
    rpd: Rpd, bd_ids: list[int], db: AsyncSession,
) -> None:
    if not bd_ids:
        return
    existing = await db.execute(
        select(RpdLearningOutcome).where(RpdLearningOutcome.id_rpd == rpd.id_rpd)
    )
    existing_by_ind: set[int] = set()
    existing_by_snap: set[tuple[str, str]] = set()
    for lo in existing.scalars().all():
        if lo.id_indicator is not None:
            existing_by_ind.add(lo.id_indicator)
        if lo.indicator_code:
            existing_by_snap.add((lo.competency_code or "", lo.indicator_code))

    res = await db.execute(
        select(CompetencyIndicator)
        .join(Competency, Competency.id_competency == CompetencyIndicator.id_competency)
        .join(BupDisciplineCompetency, BupDisciplineCompetency.id_competency == Competency.id_competency)
        .where(BupDisciplineCompetency.id_bup_discipline.in_(bd_ids))
        .options(selectinload(CompetencyIndicator.competency))
        .distinct()
    )
    for ind in res.scalars().all():
        if ind.id_indicator in existing_by_ind:
            continue
        comp = ind.competency
        snap_key = (comp.code if comp else "", ind.code or "")
        if ind.code and snap_key in existing_by_snap:
            continue
        lo = RpdLearningOutcome(
            id_rpd=rpd.id_rpd, id_indicator=ind.id_indicator,
            outcome_text=None, assessment_tool=None,
        )
        _fill_outcome_snapshot(lo, ind)
        db.add(lo)

async def _resolve_or_create_discipline(
    db: AsyncSession, *, id_discipline: int | None, name: str | None,
) -> int:
    if id_discipline:
        existing = await db.get(Discipline, id_discipline)
        if not existing:
            raise HTTPException(status_code=404, detail="Дисциплина не найдена")
        return existing.id_discipline
    if name and name.strip():
        norm = name.strip()
        res = await db.execute(select(Discipline).where(Discipline.name == norm))
        existing = res.scalar_one_or_none()
        if existing:
            return existing.id_discipline
        d = Discipline(name=norm)
        db.add(d)
        await db.flush()
        return d.id_discipline
    raise HTTPException(status_code=400, detail="Не указана дисциплина")

def _fill_manual_link(link: RpdBupDiscipline, payload, *, discipline_name: str) -> None:
    link.is_manual = True
    link.bup_name = None
    link.bup_year = None
    link.bup_profile = None
    link.direction_code = (payload.direction_code or "").strip() or None
    link.direction_name = (payload.direction_name or "").strip() or None
    link.direction_profile = (payload.direction_profile or "").strip() or None
    link.fgos_file_id = None
    link.fgos_file_name = None
    link.code = None
    link.semester = (payload.semester or "").strip() or None
    link.control_form = (payload.control_form or "").strip() or None
    link.total_hours = payload.total_hours
    link.exam_hours = payload.exam_hours
    link.lecture_hours = payload.lecture_hours
    link.lab_hours = payload.lab_hours
    link.practice_hours = payload.practice_hours
    link.ksr_hours = payload.ksr_hours
    link.self_study_hours = payload.self_study_hours
    link.zet = payload.zet
    link.semesters_data = payload.semesters_data
    link.discipline_name = discipline_name
    link.form_of_study = (payload.form_of_study or "").strip() or None
    if payload.zet is not None:
        link.total_hours = int(payload.zet) * 36

async def _validate_reviewer_ids(db: AsyncSession, reviewer_ids: list[int]) -> None:
    if not reviewer_ids:
        return
    if len(reviewer_ids) != len(set(reviewer_ids)):
        raise HTTPException(status_code=400, detail="Согласующие в маршруте не должны повторяться")
    rows = await db.execute(
        select(User).where(User.id_user.in_(reviewer_ids))
        .options(selectinload(User.role).selectinload(Role.permissions).selectinload(RolePermission.permission))
    )
    by_id = {u.id_user: u for u in rows.scalars().all()}
    if len(by_id) != len(set(reviewer_ids)):
        raise HTTPException(status_code=400, detail="Не все согласующие найдены")
    for uid in reviewer_ids:
        u = by_id[uid]
        if not user_can(u, "rpd.approve"):
            raise HTTPException(status_code=400, detail=f"У пользователя «{u.full_name}» нет права согласования")

async def _replace_approval_route(db: AsyncSession, rpd: Rpd, reviewer_ids: list[int]) -> None:
    await db.execute(
        delete(RpdApprovalRoute).where(RpdApprovalRoute.id_rpd == rpd.id_rpd)
    )
    for i, uid in enumerate(reviewer_ids):
        db.add(RpdApprovalRoute(
            id_rpd=rpd.id_rpd, step_order=i, id_reviewer=uid, status="waiting",
        ))

@router.post("/", response_model=RpdDetailOut, status_code=201)
async def create_rpd(data: RpdCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if not user_can(user, "rpd.create"):
        raise HTTPException(status_code=403, detail="Недостаточно прав для создания РПД")
    await _validate_reviewer_ids(db, data.reviewer_ids)
    if data.manual is not None:
        id_discipline = await _resolve_or_create_discipline(
            db,
            id_discipline=data.manual.id_discipline or data.id_discipline,
            name=data.manual.discipline_name,
        )
        disc = await db.get(Discipline, id_discipline)
        rpd = Rpd(
            id_discipline=id_discipline,
            id_author=user.id_user,
            academic_year=data.academic_year,
            status="Черновик",
            based_on_rpd_id=data.based_on_rpd_id,
        )
        db.add(rpd)
        await db.flush()
        link = RpdBupDiscipline(id_rpd=rpd.id_rpd, id_bup_discipline=None)
        _fill_manual_link(link, data.manual, discipline_name=disc.name if disc else "")
        db.add(link)
        if data.reviewer_ids:
            await _replace_approval_route(db, rpd, data.reviewer_ids)
        await db.commit()
        rpd_full = await _get_rpd_full(rpd.id_rpd, db)
        return _build_rpd_detail(rpd_full)

    id_discipline = data.id_discipline
    if data.bup_discipline_ids:
        rows = await db.execute(
            select(BupDiscipline)
            .where(BupDiscipline.id_bup_discipline.in_(data.bup_discipline_ids))
        )
        bds = rows.scalars().all()
        if len(bds) != len(set(data.bup_discipline_ids)):
            raise HTTPException(status_code=400, detail="Не все БУП-дисциплины найдены")
        discipline_ids = {bd.id_discipline for bd in bds}
        if len(discipline_ids) > 1:
            raise HTTPException(
                status_code=400,
                detail="Все выбранные БУП-дисциплины должны относиться к одной и той же логической дисциплине",
            )
        if len(bds) > 1:
            param_labels = {
                "total_hours": "общие часы",
                "lecture_hours": "часы лекций",
                "practice_hours": "часы практик",
                "lab_hours": "часы лабораторных",
                "ksr_hours": "часы КСР",
                "self_study_hours": "часы СРС",
                "zet": "ЗЕ",
                "semester": "семестр",
                "control_form": "форма контроля",
            }
            ref = bds[0]
            for bd in bds[1:]:
                for key, label in param_labels.items():
                    a, b = getattr(ref, key), getattr(bd, key)
                    if a != b:
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"У выбранных БУП-дисциплин различается «{label}» "
                                f"({a if a is not None else '—'} ≠ {b if b is not None else '—'}). "
                                "Один макет РПД может покрывать только БУПы с одинаковой нагрузкой. "
                                "Для разной нагрузки создайте отдельные РПД (можно через «На основе архивной»)."
                            ),
                        )
        id_discipline = bds[0].id_discipline
    if not id_discipline:
        raise HTTPException(status_code=400, detail="Не указана дисциплина или БУП-дисциплины")

    rpd = Rpd(
        id_discipline=id_discipline,
        id_author=user.id_user,
        academic_year=data.academic_year,
        status="Черновик",
        based_on_rpd_id=data.based_on_rpd_id,
    )
    if data.based_on_rpd_id:
        base_result = await db.execute(
            select(Rpd).where(Rpd.id_rpd == data.based_on_rpd_id)
            .options(
                selectinload(Rpd.sections),
                selectinload(Rpd.topics),
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

            for s in base.sections:
                new_sec = RpdSection(
                    id_rpd=rpd.id_rpd, section_number=s.section_number,
                    title=s.title, brief_content=s.brief_content,
                    lecture_hours=s.lecture_hours, practice_hours=s.practice_hours,
                    lab_hours=s.lab_hours, self_study_hours=s.self_study_hours,
                )
                db.add(new_sec)

            for t in base.topics:
                db.add(RpdTopic(
                    id_rpd=rpd.id_rpd, topic_type=t.topic_type,
                    title=t.title, hours=t.hours, description=t.description,
                ))

            for lit in base.literature:
                db.add(RpdLiterature(
                    id_rpd=rpd.id_rpd, source_type=lit.source_type,
                    title=lit.title, url=lit.url, copies_count=lit.copies_count,
                    availability=lit.availability,
                ))

            for sw in base.software:
                db.add(RpdSoftware(
                    id_rpd=rpd.id_rpd, name=sw.name,
                    license_type=sw.license_type, purpose=sw.purpose,
                ))

            for mt in base.material_tech:
                db.add(RpdMaterialTech(
                    id_rpd=rpd.id_rpd, room_type=mt.room_type, equipment=mt.equipment,
                ))

            for lo in base.learning_outcomes:
                db.add(RpdLearningOutcome(
                    id_rpd=rpd.id_rpd, id_indicator=lo.id_indicator,
                    outcome_text=lo.outcome_text, assessment_tool=lo.assessment_tool,
                    indicator_code=lo.indicator_code,
                    indicator_description=lo.indicator_description,
                    competency_code=lo.competency_code,
                    competency_name=lo.competency_name,
                ))
        else:
            db.add(rpd)
            await db.flush()
    else:
        db.add(rpd)
        await db.flush()

    await _attach_rpd_to_bup_disciplines(rpd, db, bup_discipline_ids=data.bup_discipline_ids or None)

    if data.bup_discipline_ids:
        await _autofill_outcomes_from_bup_disciplines(rpd, data.bup_discipline_ids, db)

    if data.reviewer_ids:
        await _replace_approval_route(db, rpd, data.reviewer_ids)

    await db.commit()
    rpd_full = await _get_rpd_full(rpd.id_rpd, db)
    return _build_rpd_detail(rpd_full)

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

@router.delete("/{rpd_id}", status_code=204)
async def delete_rpd(rpd_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Rpd).where(Rpd.id_rpd == rpd_id))
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")
    if rpd.id_author != user.id_user and not user_can(user, "rpd.delete_any"):
        raise HTTPException(status_code=403, detail="Нет прав на удаление")
    if rpd.status not in ("Черновик",):
        raise HTTPException(status_code=400, detail="Удалить можно только черновик")
    await db.delete(rpd)
    await db.commit()

@router.post("/{rpd_id}/sections", response_model=RpdSectionOut, status_code=201)
async def add_section(rpd_id: int, data: RpdSectionCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    section = RpdSection(id_rpd=rpd_id, **data.model_dump())
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return section

@router.put("/sections/{section_id}", response_model=RpdSectionOut)
async def update_section(section_id: int, data: RpdSectionCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdSection).where(RpdSection.id_section == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump().items():
        setattr(section, k, v)
    await db.commit()
    await db.refresh(section)
    return section

@router.delete("/sections/{section_id}", status_code=204)
async def delete_section(section_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdSection).where(RpdSection.id_section == section_id))
    section = result.scalar_one_or_none()
    if section:
        await db.delete(section)
        await db.commit()

@router.post("/{rpd_id}/topics", response_model=RpdTopicOut, status_code=201)
async def add_topic(rpd_id: int, data: RpdTopicCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    topic = RpdTopic(id_rpd=rpd_id, **data.model_dump())
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

@router.post("/{rpd_id}/outcomes", response_model=LearningOutcomeOut, status_code=201)
async def add_outcome(rpd_id: int, data: LearningOutcomeCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    lo = RpdLearningOutcome(id_rpd=rpd_id, **data.model_dump())
    db.add(lo)
    await db.flush()
    result = await db.execute(
        select(RpdLearningOutcome).where(RpdLearningOutcome.id_outcome == lo.id_outcome)
        .options(selectinload(RpdLearningOutcome.indicator).selectinload(CompetencyIndicator.competency))
    )
    lo = result.scalar_one()
    ind = lo.indicator
    if ind is not None:
        _fill_outcome_snapshot(lo, ind)
    await db.commit()
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

@router.patch("/{rpd_id}/manual-link", response_model=RpdDetailOut)
async def update_manual_link(
    rpd_id: int, data: ManualLinkUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rpd_row = await db.get(Rpd, rpd_id)
    if not rpd_row:
        raise HTTPException(status_code=404, detail="РПД не найдена")

    res = await db.execute(
        select(RpdBupDiscipline)
        .where(RpdBupDiscipline.id_rpd == rpd_id)
        .where(RpdBupDiscipline.is_manual == True)
    )
    link = res.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="У этой РПД нет ручной привязки")

    payload = data.model_dump(exclude_unset=True, exclude={"semesters_data"})
    for field, value in payload.items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(link, field, value)

    if data.semesters_data is not None:
        sd = sorted(
            [s for s in data.semesters_data if s.get("number") is not None],
            key=lambda s: s["number"],
        )
        link.semesters_data = sd
        nums = [s["number"] for s in sd]
        link.semester = ", ".join(str(n) for n in nums) or None
        link.lecture_hours = sum(int(s.get("lecture") or 0) for s in sd)
        link.lab_hours = sum(int(s.get("lab") or 0) for s in sd)
        link.practice_hours = sum(int(s.get("practice") or 0) for s in sd)
        link.ksr_hours = sum(int(s.get("ksr") or 0) for s in sd)
        link.self_study_hours = sum(int(s.get("srs") or 0) for s in sd)

    if link.zet is not None:
        link.total_hours = int(link.zet) * 36

    await db.commit()
    return _build_rpd_detail(await _get_rpd_full(rpd_id, db))

@router.post("/{rpd_id}/outcomes/manual", response_model=LearningOutcomeOut, status_code=201)
async def add_manual_outcome(
    rpd_id: int, data: ManualOutcomeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rpd = await db.get(Rpd, rpd_id)
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")
    lo = RpdLearningOutcome(
        id_rpd=rpd_id,
        id_indicator=data.id_indicator,
        outcome_text=(data.outcome_text or "").strip() or None,
        assessment_tool=(data.assessment_tool or "").strip() or None,
        indicator_code=(data.indicator_code or "").strip() or None,
        indicator_description=(data.indicator_description or "").strip() or None,
        competency_code=(data.competency_code or "").strip() or None,
        competency_name=(data.competency_name or "").strip() or None,
    )
    db.add(lo)
    await db.flush()
    if lo.id_indicator is not None:
        ind_res = await db.execute(
            select(CompetencyIndicator)
            .where(CompetencyIndicator.id_indicator == lo.id_indicator)
            .options(selectinload(CompetencyIndicator.competency))
        )
        ind = ind_res.scalar_one_or_none()
        if ind is not None:
            _fill_outcome_snapshot(lo, ind)
    await db.commit()
    return LearningOutcomeOut(
        id_outcome=lo.id_outcome, id_indicator=lo.id_indicator,
        indicator_code=lo.indicator_code,
        competency_code=lo.competency_code,
        outcome_text=lo.outcome_text,
        assessment_tool=lo.assessment_tool,
    )

@router.patch("/outcomes/{outcome_id}/snapshot", response_model=LearningOutcomeOut)
async def patch_outcome_snapshot(
    outcome_id: int, data: ManualOutcomeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    res = await db.execute(select(RpdLearningOutcome).where(RpdLearningOutcome.id_outcome == outcome_id))
    lo = res.scalar_one_or_none()
    if not lo:
        raise HTTPException(status_code=404)
    payload = data.model_dump(exclude_unset=True)
    for field in ("competency_code", "competency_name", "indicator_code", "indicator_description", "outcome_text", "assessment_tool"):
        if field in payload:
            v = payload[field]
            if isinstance(v, str):
                v = v.strip() or None
            setattr(lo, field, v)
    await db.commit()
    return LearningOutcomeOut(
        id_outcome=lo.id_outcome, id_indicator=lo.id_indicator,
        indicator_code=lo.indicator_code,
        competency_code=lo.competency_code,
        outcome_text=lo.outcome_text,
        assessment_tool=lo.assessment_tool,
    )

@router.post("/{rpd_id}/bup-disciplines/{bd_id}", response_model=RpdDetailOut, status_code=201)
async def attach_bup_discipline(
    rpd_id: int, bd_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rpd = await db.get(Rpd, rpd_id)
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")
    bd = await db.get(BupDiscipline, bd_id)
    if not bd:
        raise HTTPException(status_code=404, detail="Дисциплина БУПа не найдена")

    exists = await db.execute(
        select(RpdBupDiscipline)
        .where(RpdBupDiscipline.id_rpd == rpd_id)
        .where(RpdBupDiscipline.id_bup_discipline == bd_id)
    )
    if not exists.scalar_one_or_none():
        bd_full = await db.execute(
            select(BupDiscipline).where(BupDiscipline.id_bup_discipline == bd_id)
            .options(
                selectinload(BupDiscipline.discipline),
                selectinload(BupDiscipline.bup).selectinload(Bup.direction).selectinload(Direction.fgos_file),
            )
        )
        bd_obj = bd_full.scalar_one()
        link = RpdBupDiscipline(id_rpd=rpd_id, id_bup_discipline=bd_id)
        _fill_rpd_bup_disc_snapshot(link, bd_obj)
        db.add(link)
        await db.flush()

    existing_inds = {lo.id_indicator for lo in (
        await db.execute(select(RpdLearningOutcome).where(RpdLearningOutcome.id_rpd == rpd_id))
    ).scalars().all()}
    new_inds_res = await db.execute(
        select(CompetencyIndicator)
        .join(Competency, Competency.id_competency == CompetencyIndicator.id_competency)
        .join(BupDisciplineCompetency, BupDisciplineCompetency.id_competency == Competency.id_competency)
        .where(BupDisciplineCompetency.id_bup_discipline == bd_id)
        .options(selectinload(CompetencyIndicator.competency))
    )
    for ind in new_inds_res.scalars().all():
        if ind.id_indicator in existing_inds:
            continue
        existing_inds.add(ind.id_indicator)
        lo = RpdLearningOutcome(
            id_rpd=rpd_id, id_indicator=ind.id_indicator,
            outcome_text=None, assessment_tool=None,
        )
        _fill_outcome_snapshot(lo, ind)
        db.add(lo)
    await db.commit()
    return _build_rpd_detail(await _get_rpd_full(rpd_id, db))

@router.delete("/{rpd_id}/bup-disciplines/{bd_id}", response_model=RpdDetailOut)
async def detach_bup_discipline(
    rpd_id: int, bd_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    res = await db.execute(
        select(RpdBupDiscipline)
        .where(RpdBupDiscipline.id_rpd == rpd_id)
        .where(RpdBupDiscipline.id_bup_discipline == bd_id)
    )
    link = res.scalar_one_or_none()
    if link:
        await db.delete(link)
        await db.commit()
    return _build_rpd_detail(await _get_rpd_full(rpd_id, db))

@router.get("/{rpd_id}/outcomes-table", response_model=list[OutcomeRowOut])
async def get_outcomes_table(
    rpd_id: int,
    bd_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rpd_res = await db.execute(
        select(Rpd).where(Rpd.id_rpd == rpd_id)
        .options(
            selectinload(Rpd.learning_outcomes)
                .selectinload(RpdLearningOutcome.indicator)
                .selectinload(CompetencyIndicator.competency),
        )
    )
    rpd = rpd_res.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404)

    rows: list[OutcomeRowOut] = []
    seen_keys: set[tuple] = set()
    sorted_outcomes = sorted(
        rpd.learning_outcomes,
        key=lambda lo: (
            lo.competency_code or (lo.indicator.competency.code if lo.indicator and lo.indicator.competency else ""),
            lo.indicator_code or (lo.indicator.code if lo.indicator else ""),
        ),
    )
    for lo in sorted_outcomes:
        ind = lo.indicator
        comp = ind.competency if ind else None
        if lo.id_indicator is not None:
            key = ("ind", lo.id_indicator)
        elif lo.competency_code or lo.indicator_code:
            key = ("snap", lo.competency_code or "", lo.indicator_code or "")
        else:
            key = ("out", lo.id_outcome)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        rows.append(OutcomeRowOut(
            id_indicator=lo.id_indicator,
            indicator_code=lo.indicator_code or (ind.code if ind else "") or "",
            indicator_description=lo.indicator_description or (ind.description if ind else "") or "",
            competency_code=lo.competency_code or (comp.code if comp else "") or "",
            competency_name=lo.competency_name or (comp.name if comp else "") or "",
            id_outcome=lo.id_outcome,
            outcome_text=lo.outcome_text,
            assessment_tool=lo.assessment_tool,
        ))
    return rows

@router.post("/{rpd_id}/outcomes/upsert", response_model=LearningOutcomeOut)
async def upsert_outcome(
    rpd_id: int,
    data: OutcomeUpsert,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lo: RpdLearningOutcome | None = None
    if data.id_outcome:
        res = await db.execute(
            select(RpdLearningOutcome)
            .where(RpdLearningOutcome.id_outcome == data.id_outcome)
            .where(RpdLearningOutcome.id_rpd == rpd_id)
            .options(selectinload(RpdLearningOutcome.indicator).selectinload(CompetencyIndicator.competency))
        )
        lo = res.scalar_one_or_none()
    elif data.id_indicator:
        res = await db.execute(
            select(RpdLearningOutcome)
            .where(RpdLearningOutcome.id_rpd == rpd_id)
            .where(RpdLearningOutcome.id_indicator == data.id_indicator)
            .options(selectinload(RpdLearningOutcome.indicator).selectinload(CompetencyIndicator.competency))
        )
        lo = res.scalar_one_or_none()

    text = (data.outcome_text or "").strip()
    tool = (data.assessment_tool or "").strip()

    if lo is None:
        if not data.id_indicator:
            raise HTTPException(status_code=400, detail="Не удалось найти запись результата для обновления")
        lo = RpdLearningOutcome(
            id_rpd=rpd_id, id_indicator=data.id_indicator,
            outcome_text=text or None, assessment_tool=tool or None,
        )
        db.add(lo)
    else:
        lo.outcome_text = text or None
        lo.assessment_tool = tool or None
    await db.flush()

    res = await db.execute(
        select(RpdLearningOutcome).where(RpdLearningOutcome.id_outcome == lo.id_outcome)
        .options(selectinload(RpdLearningOutcome.indicator).selectinload(CompetencyIndicator.competency))
    )
    lo = res.scalar_one()
    ind = lo.indicator
    if ind is not None:
        _fill_outcome_snapshot(lo, ind)
    await db.commit()
    return LearningOutcomeOut(
        id_outcome=lo.id_outcome, id_indicator=lo.id_indicator,
        indicator_code=lo.indicator_code or (ind.code if ind else None),
        competency_code=lo.competency_code or (ind.competency.code if ind and ind.competency else None),
        outcome_text=lo.outcome_text, assessment_tool=lo.assessment_tool,
    )

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
    return DeveloperOut(
        id_rpd_developer=dev.id_rpd_developer,
        id_user=dev.id_user,
        full_name=dev.user.full_name,
        title=dev.user.title,
    )

@router.delete("/developers/{dev_id}", status_code=204)
async def remove_developer(dev_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(RpdDeveloper).where(RpdDeveloper.id_rpd_developer == dev_id))
    dev = result.scalar_one_or_none()
    if dev:
        await db.delete(dev)
        await db.commit()

@router.post("/{rpd_id}/send-approval", status_code=200)
async def send_for_approval(rpd_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Rpd).where(Rpd.id_rpd == rpd_id)
        .options(selectinload(Rpd.approval_route).selectinload(RpdApprovalRoute.reviewer))
    )
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404)
    if rpd.status not in ("Черновик", "На доработке"):
        raise HTTPException(status_code=400, detail="РПД не может быть отправлена на согласование в текущем статусе")

    route = sorted(rpd.approval_route or [], key=lambda s: s.step_order)
    if not route:
        raise HTTPException(status_code=400, detail="Не задан маршрут согласования")

    for step in route:
        step.status = "waiting"
        step.comment = None
        step.reviewed_at = None
    route[0].status = "pending"
    rpd.status = "На согласовании"

    first = route[0]
    db.add(ApprovalStage(
        id_rpd=rpd_id, id_reviewer=first.id_reviewer,
        stage=first.reviewer.full_name if first.reviewer else "Согласующий",
        status="Ожидание",
    ))
    db.add(Notification(
        id_user=user.id_user, id_rpd=rpd_id,
        message="РПД отправлена на согласование",
    ))
    if first.id_reviewer != user.id_user:
        db.add(Notification(
            id_user=first.id_reviewer, id_rpd=rpd_id,
            message="Вам на согласование поступила РПД",
        ))
    await db.commit()
    return {"detail": "РПД отправлена на согласование"}

@router.post("/{rpd_id}/review")
async def review_rpd(rpd_id: int, data: ApprovalAction, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if not user_can(user, "rpd.approve"):
        raise HTTPException(status_code=403, detail="Недостаточно прав для согласования")
    if data.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Неизвестное действие")

    result = await db.execute(
        select(Rpd).where(Rpd.id_rpd == rpd_id)
        .options(selectinload(Rpd.approval_route).selectinload(RpdApprovalRoute.reviewer))
    )
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404)

    route = sorted(rpd.approval_route or [], key=lambda s: s.step_order)
    current = next((s for s in route if s.status == "pending"), None)
    if current is None:
        raise HTTPException(status_code=400, detail="РПД не находится на согласовании")
    if current.id_reviewer != user.id_user:
        raise HTTPException(status_code=403, detail="Этот этап согласования назначен другому пользователю")

    now = datetime.now(timezone.utc)
    current.reviewed_at = now
    current.comment = data.comment
    stage_name = current.reviewer.full_name if current.reviewer else "Согласующий"

    if data.action == "approve":
        current.status = "approved"
        next_step = next((s for s in route if s.step_order > current.step_order), None)
        if next_step is not None:
            next_step.status = "pending"
            db.add(ApprovalStage(
                id_rpd=rpd_id, id_reviewer=next_step.id_reviewer,
                stage=next_step.reviewer.full_name if next_step.reviewer else "Согласующий",
                status="Ожидание",
            ))
            db.add(Notification(
                id_user=next_step.id_reviewer, id_rpd=rpd_id,
                message="Вам на согласование поступила РПД",
            ))
        else:
            rpd.status = "Согласовано"
    else:
        current.status = "rejected"
        rpd.status = "На доработке"

    db.add(ApprovalStage(
        id_rpd=rpd_id, id_reviewer=user.id_user, stage=stage_name,
        status="Согласовано" if data.action == "approve" else "Отклонено",
        comment=data.comment, reviewed_at=now,
    ))

    status_text = "согласована" if data.action == "approve" else "возвращена на доработку"
    msg = f"РПД {status_text}"
    if data.comment:
        msg += f": {data.comment}"
    db.add(Notification(id_user=rpd.id_author, id_rpd=rpd_id, message=msg))
    await db.commit()
    return {"detail": f"РПД {rpd.status}"}

@router.put("/{rpd_id}/approval-route", response_model=RpdDetailOut)
async def set_approval_route(
    rpd_id: int, data: ApprovalRouteUpdate,
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    result = await db.execute(select(Rpd).where(Rpd.id_rpd == rpd_id))
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404)
    is_owner = rpd.id_author == user.id_user
    has_chain_perm = user_can(user, "approval_chain.edit")
    if not is_owner and not has_chain_perm:
        raise HTTPException(status_code=403, detail="Нет прав на изменение маршрута согласования")
    if rpd.status == "Согласовано":
        raise HTTPException(status_code=400, detail="Маршрут согласованной РПД менять нельзя")
    if rpd.status == "На согласовании" and not has_chain_perm:
        raise HTTPException(status_code=400, detail="Маршрут можно менять только в черновике или после возврата")

    await _validate_reviewer_ids(db, data.reviewer_ids)
    await _replace_approval_route(db, rpd, data.reviewer_ids)

    if rpd.status == "На согласовании" and data.reviewer_ids:
        await db.flush()
        new_route_res = await db.execute(
            select(RpdApprovalRoute)
            .where(RpdApprovalRoute.id_rpd == rpd_id)
            .order_by(RpdApprovalRoute.step_order)
            .options(selectinload(RpdApprovalRoute.reviewer))
        )
        new_route = list(new_route_res.scalars().all())
        if new_route:
            first = new_route[0]
            first.status = "pending"
            db.add(ApprovalStage(
                id_rpd=rpd_id, id_reviewer=first.id_reviewer,
                stage=first.reviewer.full_name if first.reviewer else "Согласующий",
                status="Ожидание",
            ))
            db.add(Notification(
                id_user=first.id_reviewer, id_rpd=rpd_id,
                message="Маршрут согласования был изменён, РПД ожидает вашего согласования",
            ))

    await db.commit()
    return _build_rpd_detail(await _get_rpd_full(rpd_id, db))

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
