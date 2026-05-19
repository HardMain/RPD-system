import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User, UploadedDocument, Rpd
from app.models import UploadedDocumentSection
from app.schemas import UploadedDocumentOut
from app.services.document_sections import extract_and_save_sections
from app.services.llm_service import CONTEXT_CHAR_LIMIT

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
    try:
        await extract_and_save_sections(db, doc.id_document, doc.file_path)
    except Exception:
        pass
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
    file_path = doc.file_path
    await db.execute(
        delete(UploadedDocumentSection).where(UploadedDocumentSection.id_document == doc_id)
    )
    await db.delete(doc)
    await db.commit()
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

@router.get("/doc/{doc_id}/sections")
async def document_sections(doc_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(UploadedDocumentSection)
        .where(UploadedDocumentSection.id_document == doc_id)
        .order_by(UploadedDocumentSection.id_section_chunk)
    )
    chunks = result.scalars().all()
    return {
        "context_char_limit": CONTEXT_CHAR_LIMIT,
        "sections": [
            {
                "id_section_chunk": c.id_section_chunk,
                "section_key": c.section_key,
                "extraction_method": c.extraction_method,
                "content": c.content or "",
                "length": len(c.content or ""),
            }
            for c in chunks
        ],
    }

@router.delete("/section/{chunk_id}", status_code=204)
async def delete_document_section(chunk_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(UploadedDocumentSection).where(UploadedDocumentSection.id_section_chunk == chunk_id)
    )
    chunk = result.scalar_one_or_none()
    if not chunk:
        raise HTTPException(status_code=404)
    await db.delete(chunk)
    await db.commit()
