from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, user_can
from app.core.database import get_db
from app.models import User
from app.services.app_settings import (
    LLM_MODEL_CHOICES, get_llm_model, set_setting, LLM_MODEL_KEY,
)

router = APIRouter(prefix="/api/admin/system", tags=["admin-system"])


def _require_admin(user: User) -> None:
    if not user_can(user, "*"):
        raise HTTPException(status_code=403, detail="Только администратору")


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
