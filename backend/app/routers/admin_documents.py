import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, user_can
from app.core.config import settings
from app.core.database import get_db
from app.models import User, UploadedDocument, UploadedDocumentSection, LlmPrompt
from app.schemas import UploadedDocumentOut
from app.services.document_sections import extract_and_save_sections

router = APIRouter(prefix="/api/admin/documents", tags=["admin-documents"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".xlsx", ".xls"}
MAX_SIZE = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def _ensure_perm(user: User) -> None:
    if not user_can(user, "sources.manage"):
        raise HTTPException(status_code=403, detail="Недостаточно прав для управления справочниками")


def _ensure_upload_dir():
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@router.get("/", response_model=list[UploadedDocumentOut])
async def list_global_documents(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    res = await db.execute(
        select(UploadedDocument)
        .where(UploadedDocument.id_rpd.is_(None))
        .order_by(UploadedDocument.uploaded_at.desc())
    )
    return res.scalars().all()


@router.post("/", response_model=UploadedDocumentOut, status_code=201)
async def upload_global_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Допустимые форматы: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
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
        id_rpd=None,
        id_user=user.id_user,
        filename=file.filename,
        file_path=file_path,
        file_type=ext.lstrip("."),
        file_size=len(content),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    try:
        await extract_and_save_sections(db, doc.id_document, doc.file_path)
    except Exception:
        pass
    return doc


@router.get("/{doc_id}/download")
async def download_global_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    res = await db.execute(
        select(UploadedDocument)
        .where(UploadedDocument.id_document == doc_id)
        .where(UploadedDocument.id_rpd.is_(None))
    )
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404)
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Файл не найден на диске")
    return FileResponse(doc.file_path, filename=doc.filename)


@router.get("/{doc_id}/sections")
async def list_document_sections(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    doc = await db.get(UploadedDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404)
    res = await db.execute(
        select(UploadedDocumentSection, LlmPrompt.section_label, LlmPrompt.order_index)
        .outerjoin(LlmPrompt, LlmPrompt.section_key == UploadedDocumentSection.section_key)
        .where(UploadedDocumentSection.id_document == doc_id)
        .order_by(LlmPrompt.order_index.nullslast(), UploadedDocumentSection.section_key)
    )
    rows = res.all()
    return [
        {
            "section_key": chunk.section_key,
            "section_label": label or chunk.section_key,
            "content": chunk.content,
            "char_count": len(chunk.content) if chunk.content else 0,
            "extraction_method": chunk.extraction_method,
            "created_at": chunk.created_at.isoformat() if chunk.created_at else None,
        }
        for chunk, label, _ in rows
    ]


@router.post("/{doc_id}/reparse", status_code=200)
async def reparse_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    doc = await db.get(UploadedDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404)
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Файл не найден на диске")
    count = await extract_and_save_sections(db, doc.id_document, doc.file_path)
    return {"sections_extracted": count}


@router.delete("/{doc_id}", status_code=204)
async def delete_global_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_perm(user)
    res = await db.execute(
        select(UploadedDocument)
        .where(UploadedDocument.id_document == doc_id)
        .where(UploadedDocument.id_rpd.is_(None))
    )
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404)
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass
    await db.delete(doc)
    await db.commit()
    return
