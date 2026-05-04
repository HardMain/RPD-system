from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel

class StoredFileOut(BaseModel):
    id_file: int
    kind: str
    original_name: str
    mime: str | None = None
    size_bytes: int | None = None
    storage_uri: str
    uploaded_at: datetime | None = None
    uploaded_by_name: str | None = None

    class Config:
        from_attributes = True
