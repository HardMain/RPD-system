from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, user_can
from app.core.database import get_db
from app.models import User
from app.services.app_settings import (
    LLM_MODEL_CHOICES, get_llm_model, set_setting, LLM_MODEL_KEY,
    get_approver, APPROVER_POSITION_KEY, APPROVER_NAME_KEY,
    get_system_prompt, get_saved_system_prompt_default,
    LLM_SYSTEM_PROMPT_KEY, LLM_SYSTEM_PROMPT_DEFAULT_KEY,
    DEFAULT_LLM_SYSTEM_PROMPT,
)

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
