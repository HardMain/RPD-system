from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, user_can
from app.core.crud import get_or_404, ensure_permission
from app.core.database import get_db
from app.models import User, LlmPrompt, LlmGenerationLog, Rpd

router = APIRouter(prefix="/api/admin/llm-prompts", tags=["admin-llm-prompts"])


class LlmPromptOut(BaseModel):
    id_prompt: int
    section_key: str
    section_label: str
    is_structural: bool
    system_prompt: str | None = None
    default_system_prompt: str | None = None
    user_prompt_template: str
    default_user_prompt_template: str
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
    ensure_permission(user, "users.manage", "sources.manage")


def _ensure_admin(user: User) -> None:
    if not user_can(user, "*"):
        raise HTTPException(status_code=403, detail="Только администратору")


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
    prompt = await get_or_404(db, LlmPrompt, id_prompt, "Промпт не найден")
    payload = data.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(prompt, key, value)
    await db.commit()
    await db.refresh(prompt)
    return prompt


@router.post("/{id_prompt}/save-default", response_model=LlmPromptOut)
async def save_prompt_default(
    id_prompt: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_admin(user)
    prompt = await get_or_404(db, LlmPrompt, id_prompt, "Промпт не найден")
    prompt.default_user_prompt_template = prompt.user_prompt_template
    prompt.default_system_prompt = prompt.system_prompt
    await db.commit()
    await db.refresh(prompt)
    return prompt


@router.post("/{id_prompt}/restore-default", response_model=LlmPromptOut)
async def restore_prompt_default(
    id_prompt: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_admin(user)
    prompt = await get_or_404(db, LlmPrompt, id_prompt, "Промпт не найден")
    if not prompt.default_user_prompt_template:
        raise HTTPException(status_code=400, detail="Дефолтный промпт ещё не сохранён")
    prompt.user_prompt_template = prompt.default_user_prompt_template
    prompt.system_prompt = prompt.default_system_prompt
    await db.commit()
    await db.refresh(prompt)
    return prompt


@router.get("/logs")
async def list_generation_logs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    labels = dict(
        (await db.execute(select(LlmPrompt.section_key, LlmPrompt.section_label))).all()
    )
    result = await db.execute(
        select(LlmGenerationLog, Rpd)
        .join(Rpd, Rpd.id_rpd == LlmGenerationLog.id_rpd)
        .options(selectinload(Rpd.discipline))
        .order_by(LlmGenerationLog.created_at.desc())
        .limit(200)
    )
    out = []
    for log, rpd in result.all():
        disc = rpd.discipline.name if rpd.discipline else "—"
        out.append({
            "id_log": log.id_log,
            "id_rpd": log.id_rpd,
            "rpd_label": f"{disc} ({rpd.academic_year})" if rpd.academic_year else disc,
            "section_name": log.section_name,
            "section_label": labels.get(log.section_name, log.section_name),
            "model_name": log.model_name,
            "tokens_used": log.tokens_used,
            "generation_time_ms": log.generation_time_ms,
            "context_sources": (log.context_sources.split("\n") if log.context_sources else []),
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return out
