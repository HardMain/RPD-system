import re
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UploadedDocument, UploadedDocumentSection
from app.services.llm_service import extract_text_from_file


_HEADING_RULES: list[tuple[str, str]] = [
    ("learning_outcomes", r"планируем[ыо]е\s+результат\w*\s+обучен"),
    ("goals", r"цел[ьи]\s+и\s+задач\w+\s+дисциплин"),
    ("objects", r"изучаем[ыо]е\s+объект\w*"),
    ("requirements", r"входн[ыо]е\s+требован\w*|пререквизит"),
    ("content", r"содержан\w+\s+дисциплин|тематическ\w+\s+план"),
    ("topics_practice", r"тематик\w*\s+(?:примерных\s+|приблизительных\s+)?практическ"),
    ("topics_lab", r"тематик\w*\s+(?:примерных\s+|приблизительных\s+)?лабораторн"),
    ("educational_tech", r"образовательн\w+\s+технологи"),
    ("methodical_recommendations", r"методическ\w+\s+(?:указани|рекомендаци)\w*\s+(?:для\s+)?(?:обуча|студент)"),
    ("literature_periodicals", r"периодическ\w+\s+издан"),
    ("literature_normative", r"нормативно-техническ\w+\s+издан|нормативно-правов\w+\s+документ"),
    ("literature_methodical_students", r"методическ\w+\s+указан\w*.{0,40}освоен"),
    ("literature_methodical_self_study", r"(?:учебно-)?методическ\w+\s+обеспеч\w+.{0,40}самостоятельн\w+\s+работ"),
    ("literature_printed_additional", r"дополнительн\w+\s+литератур"),
    ("literature_printed_main", r"основн\w+\s+литератур"),
    ("literature_electronic", r"электронн\w+\s+(?:учебно-методич|литератур|информацион)|электронные\s+ресурс|электронно-библиотечн"),
    ("databases", r"(?:соврем\w+\s+)?(?:професси\w+\s+)?баз[ыа]?\s+данных"),
    ("software", r"программн\w+\s+обеспеч"),
    ("material_tech", r"материально-техническ\w+\s+обеспеч"),
]

_COMPILED_RULES = [(key, re.compile(pat, re.IGNORECASE)) for key, pat in _HEADING_RULES]

_NUMBER_PREFIX_RE = re.compile(r"^[\d]+(?:\.\d+)*\.?\s*")
_LEADING_PUNCT_RE = re.compile(r"^[\s\-—.«»\"'*#§№]+")

_PER_CHUNK_CHAR_CAP = 2500


def _classify_line(line: str) -> str | None:
    stripped = line.strip()
    if not stripped or len(stripped) > 250:
        return None
    cleaned = _LEADING_PUNCT_RE.sub("", stripped)
    cleaned = _NUMBER_PREFIX_RE.sub("", cleaned)
    cleaned = _LEADING_PUNCT_RE.sub("", cleaned)
    if len(cleaned) < 6 or len(cleaned) > 200:
        return None
    if cleaned.endswith("."):
        cleaned = cleaned[:-1]
    for key, pattern in _COMPILED_RULES:
        if pattern.search(cleaned):
            return key
    return None


def extract_sections_heuristic(text: str) -> dict[str, str]:
    if not text:
        return {}
    lines = text.split("\n")
    matches: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        key = _classify_line(line)
        if key:
            matches.append((i, key))
    sections: dict[str, str] = {}
    for j, (start_idx, key) in enumerate(matches):
        end_idx = matches[j + 1][0] if j + 1 < len(matches) else len(lines)
        body_lines = lines[start_idx + 1:end_idx]
        body = "\n".join(body_lines).strip()
        body = re.sub(r"\n{3,}", "\n\n", body)
        if not body or len(body) < 20:
            continue
        if key in sections:
            continue
        sections[key] = body[:_PER_CHUNK_CHAR_CAP]
    return sections


async def extract_and_save_sections(db: AsyncSession, document_id: int, file_path: str) -> int:
    text = await extract_text_from_file(file_path)
    if not text:
        return 0
    sections = extract_sections_heuristic(text)
    if not sections:
        return 0
    await db.execute(
        delete(UploadedDocumentSection).where(UploadedDocumentSection.id_document == document_id)
    )
    for key, content in sections.items():
        db.add(UploadedDocumentSection(
            id_document=document_id,
            section_key=key,
            content=content,
            extraction_method="heuristic",
        ))
    await db.commit()
    return len(sections)


async def backfill_unprocessed_documents(db: AsyncSession) -> int:
    docs_res = await db.execute(select(UploadedDocument))
    docs = docs_res.scalars().all()
    if not docs:
        return 0
    existing_res = await db.execute(select(UploadedDocumentSection.id_document).distinct())
    processed_ids = {row[0] for row in existing_res.all()}
    processed_total = 0
    for doc in docs:
        if doc.id_document in processed_ids:
            continue
        try:
            count = await extract_and_save_sections(db, doc.id_document, doc.file_path)
            if count:
                processed_total += 1
        except Exception:
            continue
    return processed_total
