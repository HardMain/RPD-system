from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, user_can
from app.core.database import get_db
from app.models import User, LlmPrompt

router = APIRouter(prefix="/api/admin/llm-prompts", tags=["admin-llm-prompts"])


class LlmPromptOut(BaseModel):
    id_prompt: int
    section_key: str
    section_label: str
    is_structural: bool
    system_prompt: str | None = None
    user_prompt_template: str
    description: str | None = None
    order_index: int
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class LlmPromptUpdate(BaseModel):
    section_label: str | None = None
    system_prompt: str | None = None
    user_prompt_template: str | None = None
    description: str | None = None


def _ensure_perm(user: User) -> None:
    if not (user_can(user, "users.manage") or user_can(user, "sources.manage")):
        raise HTTPException(status_code=403, detail="Недостаточно прав для управления промптами LLM")


@router.get("/", response_model=list[LlmPromptOut])
async def list_prompts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    result = await db.execute(
        select(LlmPrompt).order_by(LlmPrompt.order_index, LlmPrompt.id_prompt)
    )
    return result.scalars().all()


@router.patch("/{id_prompt}", response_model=LlmPromptOut)
async def update_prompt(
    id_prompt: int,
    data: LlmPromptUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    prompt = await db.get(LlmPrompt, id_prompt)
    if not prompt:
        raise HTTPException(status_code=404, detail="Промпт не найден")
    payload = data.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(prompt, key, value)
    await db.commit()
    await db.refresh(prompt)
    return prompt
