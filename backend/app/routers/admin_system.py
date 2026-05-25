import base64

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, user_can
from app.core.database import get_db
from app.models import User, StoredFile
from app.services import storage_service
from app.services.app_settings import (
    LLM_MODEL_CHOICES, get_llm_model, set_setting, LLM_MODEL_KEY,
    get_approver, APPROVER_POSITION_KEY, APPROVER_NAME_KEY,
    APPROVER_SIGNATURE_FILE_ID_KEY, get_approver_signature_file_id,
    get_system_prompt, get_saved_system_prompt_default,
    LLM_SYSTEM_PROMPT_KEY, LLM_SYSTEM_PROMPT_DEFAULT_KEY,
    DEFAULT_LLM_SYSTEM_PROMPT,
)

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
