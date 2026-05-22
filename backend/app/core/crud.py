from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Rpd
from app.core.auth import user_can


async def get_or_404(db: AsyncSession, model, pk, detail=None):
    obj = await db.get(model, pk)
    if obj is None:
        raise HTTPException(status_code=404, detail=detail)
    return obj


def ensure_permission(user: User, *codes: str, detail: str = "Недостаточно прав") -> None:
    if not any(user_can(user, code) for code in codes):
        raise HTTPException(status_code=403, detail=detail)


RPD_OPEN_EDIT_STATUSES = ("Черновик", "На доработке")


def assert_rpd_editable(rpd: Rpd | None, user: User) -> Rpd:
    if rpd is None:
        raise HTTPException(status_code=404, detail="РПД не найдена")
    if rpd.status in RPD_OPEN_EDIT_STATUSES:
        return rpd
    if rpd.status == "На согласовании" and user_can(user, "rpd.edit_meta"):
        return rpd
    raise HTTPException(
        status_code=403,
        detail=f"РПД в статусе «{rpd.status}» редактировать нельзя",
    )


async def ensure_rpd_editable(db: AsyncSession, rpd_id: int, user: User) -> Rpd:
    rpd = await db.get(Rpd, rpd_id)
    return assert_rpd_editable(rpd, user)
