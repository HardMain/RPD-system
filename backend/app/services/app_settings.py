from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session
from app.models import AppSetting

LLM_MODEL_KEY = "llm_model"

APPROVER_POSITION_KEY = "approver_position"
APPROVER_NAME_KEY = "approver_name"
DEFAULT_APPROVER_POSITION = "Проректор по образовательной деятельности"
DEFAULT_APPROVER_NAME = "И.Ю.Черникова"

LLM_MODEL_CHOICES = [
    ("deepseek/deepseek-chat-v3.1", "DeepSeek V3.1"),
    ("google/gemini-2.0-flash-001", "Gemini 2.0 Flash"),
    ("openai/gpt-4o-mini", "GPT-4o mini"),
    ("anthropic/claude-3.5-sonnet", "Claude 3.5 Sonnet"),
    ("meta-llama/llama-3.3-70b-instruct", "Llama 3.3 70B"),
]

_cache: dict[str, str | None] = {}


async def get_setting(key: str, default: str | None = None) -> str | None:
    if key in _cache:
        return _cache[key]
    async with async_session() as db:
        res = await db.execute(select(AppSetting.value).where(AppSetting.key == key))
        row = res.scalar_one_or_none()
    value = row if row is not None else default
    _cache[key] = value
    return value


async def set_setting(db: AsyncSession, key: str, value: str) -> None:
    res = await db.execute(select(AppSetting).where(AppSetting.key == key))
    obj = res.scalar_one_or_none()
    if obj is None:
        db.add(AppSetting(key=key, value=value))
    else:
        obj.value = value
    await db.commit()
    _cache[key] = value


async def get_llm_model() -> str:
    value = await get_setting(LLM_MODEL_KEY, settings.LLM_MODEL)
    return value or settings.LLM_MODEL


async def get_approver() -> dict[str, str]:
    position = await get_setting(APPROVER_POSITION_KEY, DEFAULT_APPROVER_POSITION)
    name = await get_setting(APPROVER_NAME_KEY, DEFAULT_APPROVER_NAME)
    return {
        "position": (position or "").strip() or DEFAULT_APPROVER_POSITION,
        "name": (name or "").strip() or DEFAULT_APPROVER_NAME,
    }
