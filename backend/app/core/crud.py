from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.core.auth import user_can


async def get_or_404(db: AsyncSession, model, pk, detail=None):
    obj = await db.get(model, pk)
    if obj is None:
        raise HTTPException(status_code=404, detail=detail)
    return obj


def ensure_permission(user: User, *codes: str, detail: str = "Недостаточно прав") -> None:
    if not any(user_can(user, code) for code in codes):
        raise HTTPException(status_code=403, detail=detail)
