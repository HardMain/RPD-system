import asyncio
import base64
import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user, user_can
from app.core.database import get_db
from app.models import (
    User, StoredFile, Rpd, Discipline, Bup, BupDiscipline, BupDisciplineCompetency,
    RpdSection, RpdTopic, RpdLiterature, RpdSoftware, RpdMaterialTech, RpdDatabase,
    RpdLearningOutcome, RpdDeveloper, CompetencyIndicator, Competency,
    RpdBupDiscipline, RpdApprovalRoute,
)
from app.services import storage_service
from app.services.app_settings import (
    LLM_MODEL_CHOICES, get_llm_model, set_setting, LLM_MODEL_KEY,
    get_approver, APPROVER_POSITION_KEY, APPROVER_NAME_KEY,
    APPROVER_SIGNATURE_FILE_ID_KEY, get_approver_signature_file_id,
    APPROVER_SIGNATURE_X_KEY, APPROVER_SIGNATURE_Y_KEY,
    APPROVER_SIGNATURE_WIDTH_MM_KEY, APPROVER_SIGNATURE_HEIGHT_MM_KEY,
    SIGNATURE_MIN_MM, SIGNATURE_MAX_MM,
    get_approver_signature_position,
    get_system_prompt, get_saved_system_prompt_default,
    LLM_SYSTEM_PROMPT_KEY, LLM_SYSTEM_PROMPT_DEFAULT_KEY,
    DEFAULT_LLM_SYSTEM_PROMPT,
)
from app.services.docx_renderer import render_rpd_pdf_bytes
from app.services.pdf_overlay import render_first_page_png, get_page_size_pt
from app.services.rpd_template_context import build_context

SIGNATURE_MAX_BYTES = 2_000_000

router = APIRouter(prefix="/api/admin/system", tags=["admin-system"])


def _require_admin(user: User) -> None:
    if not user_can(user, "*"):
        raise HTTPException(status_code=403, detail="Только администратору")


def _require_settings_access(user: User) -> None:
    if not (user_can(user, "*") or user_can(user, "users.create")):
        raise HTTPException(status_code=403, detail="Недостаточно прав")


class LlmModelOut(BaseModel):
    current: str
    choices: list[dict]


class LlmModelIn(BaseModel):
    model: str


@router.get("/llm-model", response_model=LlmModelOut)
async def get_llm_model_setting(user: User = Depends(get_current_user)):
    _require_admin(user)
    current = await get_llm_model()
    return LlmModelOut(
        current=current,
        choices=[{"id": mid, "label": lbl} for mid, lbl in LLM_MODEL_CHOICES],
    )


@router.patch("/llm-model", response_model=LlmModelOut)
async def update_llm_model(
    payload: LlmModelIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    allowed = {mid for mid, _ in LLM_MODEL_CHOICES}
    if payload.model not in allowed:
        raise HTTPException(status_code=400, detail="Модель отсутствует в списке доступных")
    await set_setting(db, LLM_MODEL_KEY, payload.model)
    current = await get_llm_model()
    return LlmModelOut(
        current=current,
        choices=[{"id": mid, "label": lbl} for mid, lbl in LLM_MODEL_CHOICES],
    )


class ApproverOut(BaseModel):
    position: str
    name: str


class ApproverIn(BaseModel):
    position: str
    name: str


@router.get("/approver", response_model=ApproverOut)
async def get_approver_setting(user: User = Depends(get_current_user)):
    _require_settings_access(user)
    data = await get_approver()
    return ApproverOut(position=data["position"], name=data["name"])


@router.patch("/approver", response_model=ApproverOut)
async def update_approver_setting(
    payload: ApproverIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_settings_access(user)
    await set_setting(db, APPROVER_POSITION_KEY, payload.position.strip())
    await set_setting(db, APPROVER_NAME_KEY, payload.name.strip())
    data = await get_approver()
    return ApproverOut(position=data["position"], name=data["name"])


class SystemPromptOut(BaseModel):
    prompt: str
    saved_default: str


class SystemPromptIn(BaseModel):
    prompt: str


async def _system_prompt_out() -> SystemPromptOut:
    return SystemPromptOut(
        prompt=await get_system_prompt(),
        saved_default=await get_saved_system_prompt_default(),
    )


@router.get("/system-prompt", response_model=SystemPromptOut)
async def get_system_prompt_setting(user: User = Depends(get_current_user)):
    _require_admin(user)
    return await _system_prompt_out()


@router.patch("/system-prompt", response_model=SystemPromptOut)
async def update_system_prompt_setting(
    payload: SystemPromptIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    text = (payload.prompt or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Системный промпт не может быть пустым")
    await set_setting(db, LLM_SYSTEM_PROMPT_KEY, text)
    return await _system_prompt_out()


@router.post("/system-prompt/save-default", response_model=SystemPromptOut)
async def save_system_prompt_default(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    current = await get_system_prompt()
    await set_setting(db, LLM_SYSTEM_PROMPT_DEFAULT_KEY, current)
    return await _system_prompt_out()


@router.post("/system-prompt/restore-default", response_model=SystemPromptOut)
async def restore_system_prompt_default(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    saved = await get_saved_system_prompt_default()
    await set_setting(db, LLM_SYSTEM_PROMPT_KEY, saved)
    return await _system_prompt_out()


class SignatureOut(BaseModel):
    has_signature: bool
    data_url: str | None
    filename: str | None


async def _signature_out(db: AsyncSession) -> SignatureOut:
    file_id = await get_approver_signature_file_id()
    if not file_id:
        return SignatureOut(has_signature=False, data_url=None, filename=None)
    sf = await db.get(StoredFile, file_id)
    if not sf:
        return SignatureOut(has_signature=False, data_url=None, filename=None)
    try:
        raw = storage_service.read_bytes(sf.storage_uri)
        b64 = base64.b64encode(raw).decode("ascii")
        return SignatureOut(
            has_signature=True,
            data_url=f"data:{sf.mime or 'image/png'};base64,{b64}",
            filename=sf.original_name,
        )
    except Exception:
        return SignatureOut(has_signature=False, data_url=None, filename=None)


@router.get("/approver-signature", response_model=SignatureOut)
async def get_approver_signature(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_settings_access(user)
    return await _signature_out(db)


@router.post("/approver-signature", response_model=SignatureOut)
async def upload_approver_signature(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_settings_access(user)
    mime = (file.content_type or "").lower()
    if mime != "image/png":
        raise HTTPException(status_code=400, detail="Ожидается PNG-изображение")
    content = await file.read()
    if len(content) > SIGNATURE_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Файл слишком большой (максимум 2 МБ)")
    if not content:
        raise HTTPException(status_code=400, detail="Пустой файл")

    old_id = await get_approver_signature_file_id()
    storage_uri, size = storage_service.save_bytes("signature", file.filename or "signature.png", content)
    sf = StoredFile(
        kind="signature", original_name=file.filename or "signature.png", mime=mime,
        size_bytes=size, storage_uri=storage_uri, id_uploaded_by=user.id_user,
    )
    db.add(sf)
    await db.flush()
    await set_setting(db, APPROVER_SIGNATURE_FILE_ID_KEY, str(sf.id_file))
    if old_id:
        old = await db.get(StoredFile, old_id)
        if old:
            storage_service.delete(old.storage_uri)
            await db.delete(old)
    await db.commit()
    return await _signature_out(db)


@router.delete("/approver-signature", response_model=SignatureOut)
async def delete_approver_signature(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_settings_access(user)
    old_id = await get_approver_signature_file_id()
    await set_setting(db, APPROVER_SIGNATURE_FILE_ID_KEY, "")
    if old_id:
        old = await db.get(StoredFile, old_id)
        if old:
            storage_service.delete(old.storage_uri)
            await db.delete(old)
    await db.commit()
    return await _signature_out(db)


class SignaturePositionOut(BaseModel):
    x: float
    y: float
    width_mm: float
    height_mm: float


class SignaturePositionIn(BaseModel):
    x: float | None = None
    y: float | None = None
    width_mm: float | None = None
    height_mm: float | None = None


@router.get("/approver-signature/position", response_model=SignaturePositionOut)
async def get_signature_position(user: User = Depends(get_current_user)):
    _require_settings_access(user)
    p = await get_approver_signature_position()
    return SignaturePositionOut(**p)


@router.patch("/approver-signature/position", response_model=SignaturePositionOut)
async def set_signature_position(
    payload: SignaturePositionIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_settings_access(user)
    if payload.x is not None:
        x = max(0.0, min(1.0, float(payload.x)))
        await set_setting(db, APPROVER_SIGNATURE_X_KEY, f"{x:.5f}")
    if payload.y is not None:
        y = max(0.0, min(1.0, float(payload.y)))
        await set_setting(db, APPROVER_SIGNATURE_Y_KEY, f"{y:.5f}")
    if payload.width_mm is not None:
        w = max(SIGNATURE_MIN_MM, min(SIGNATURE_MAX_MM, float(payload.width_mm)))
        await set_setting(db, APPROVER_SIGNATURE_WIDTH_MM_KEY, f"{w:.3f}")
    if payload.height_mm is not None:
        h = max(SIGNATURE_MIN_MM, min(SIGNATURE_MAX_MM, float(payload.height_mm)))
        await set_setting(db, APPROVER_SIGNATURE_HEIGHT_MM_KEY, f"{h:.3f}")
    p = await get_approver_signature_position()
    return SignaturePositionOut(**p)


_TEMPLATES_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "templates")
)
_TEMPLATE_APPROVED = os.path.join(_TEMPLATES_DIR, "rpd_template.docx")


async def _load_sample_rpd_for_preview(db: AsyncSession) -> Rpd | None:
    res = await db.execute(
        select(Rpd)
        .order_by(Rpd.id_rpd.asc())
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
        )
        .limit(1)
    )
    return res.scalars().first()


class SignaturePreviewOut(BaseModel):
    image_data_url: str
    page_w_pt: float
    page_h_pt: float


@router.get("/approver-signature/title-page-preview", response_model=SignaturePreviewOut)
async def get_title_page_preview(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_settings_access(user)
    rpd = await _load_sample_rpd_for_preview(db)
    if rpd is None:
        raise HTTPException(status_code=404, detail="Нет ни одной РПД для построения превью")
    if not os.path.exists(_TEMPLATE_APPROVED):
        raise HTTPException(status_code=500, detail=f"Шаблон не найден: {_TEMPLATE_APPROVED}")
    link = next(iter(rpd.bup_links or []), None)
    bd = link.bup_discipline if link else None
    approver = await get_approver()
    context = build_context(rpd, bd=bd, link=link, approver=approver, approval_date=None)
    try:
        pdf_bytes = await asyncio.to_thread(
            render_rpd_pdf_bytes, _TEMPLATE_APPROVED, context, None,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ошибка рендера превью: {exc}")
    try:
        png_bytes = await asyncio.to_thread(render_first_page_png, pdf_bytes, 110)
        w_pt, h_pt = get_page_size_pt(pdf_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ошибка извлечения первой страницы: {exc}")
    b64 = base64.b64encode(png_bytes).decode("ascii")
    return SignaturePreviewOut(
        image_data_url=f"data:image/png;base64,{b64}",
        page_w_pt=w_pt,
        page_h_pt=h_pt,
    )
