import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User, UploadedDocument, Rpd
from app.schemas import UploadedDocumentOut

router = APIRouter(prefix="/api/upload", tags=["upload"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".xlsx", ".xls"}
MAX_SIZE = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

def _ensure_upload_dir():
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

@router.post("/{rpd_id}", response_model=UploadedDocumentOut, status_code=201)
async def upload_document(
    rpd_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Rpd).where(Rpd.id_rpd == rpd_id))
    rpd = result.scalar_one_or_none()
    if not rpd:
        raise HTTPException(status_code=404, detail="РПД не найдена")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Допустимые форматы: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail=f"Максимальный размер файла: {settings.MAX_UPLOAD_SIZE_MB} МБ")

    _ensure_upload_dir()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_name)
    with open(file_path, "wb") as f:
        f.write(content)

    doc = UploadedDocument(
        id_rpd=rpd_id,
        id_user=user.id_user,
        filename=file.filename,
        file_path=file_path,
        file_type=ext.lstrip("."),
        file_size=len(content),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc

@router.get("/{rpd_id}", response_model=list[UploadedDocumentOut])
async def list_documents(rpd_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(UploadedDocument)
        .where(UploadedDocument.id_rpd == rpd_id)
        .order_by(UploadedDocument.uploaded_at.desc())
    )
    return result.scalars().all()

@router.get("/download/{doc_id}")
async def download_document(doc_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(UploadedDocument).where(UploadedDocument.id_document == doc_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Файл не найден на диске")
    return FileResponse(doc.file_path, filename=doc.filename)

@router.delete("/{doc_id}", status_code=204)
async def delete_document(doc_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(UploadedDocument).where(UploadedDocument.id_document == doc_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404)
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    await db.delete(doc)
    await db.commit()
