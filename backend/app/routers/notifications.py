from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User, Notification
from app.schemas import NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/", response_model=list[NotificationOut])
async def list_notifications(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Notification)
        .where(Notification.id_user == user.id_user)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.get("/unread-count")
async def unread_count(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from sqlalchemy import func as sa_func
    result = await db.execute(
        select(sa_func.count(Notification.id_notification))
        .where(Notification.id_user == user.id_user, Notification.is_read == False)
    )
    count = result.scalar()
    return {"count": count or 0}


@router.post("/{notification_id}/read", status_code=200)
async def mark_read(notification_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Notification).where(
            Notification.id_notification == notification_id,
            Notification.id_user == user.id_user,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404)
    notif.is_read = True
    await db.commit()
    return {"detail": "ok"}


@router.post("/read-all", status_code=200)
async def read_all(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await db.execute(
        update(Notification)
        .where(Notification.id_user == user.id_user, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"detail": "ok"}
