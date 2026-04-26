"""Notification schemas."""
from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime


class NotificationOut(BaseModel):
    id_notification: int
    message: str
    is_read: bool
    id_rpd: int | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True
