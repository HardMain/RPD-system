"""Просмотр/скачивание файлов из stored_files. Доступно всем авторизованным."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models import StoredFile, User
from app.services import storage_service

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/{file_id}")
async def download_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sf = await db.get(StoredFile, file_id)
    if not sf:
        raise HTTPException(status_code=404, detail="Файл не найден")
    try:
        path = storage_service.resolve_path(sf.storage_uri)
    except (FileNotFoundError, ValueError):
        raise HTTPException(status_code=404, detail="Файл отсутствует на диске")
    return FileResponse(path, filename=sf.original_name, media_type=sf.mime or "application/octet-stream")
