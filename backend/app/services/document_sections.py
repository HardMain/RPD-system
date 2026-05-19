import re
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UploadedDocument, UploadedDocumentSection
from app.services.llm_service import extract_text_from_file


_HEADING_RULES: list[tuple[str, str]] = [
    ("_b_general", r"общие\s+положения"),
    ("_b_volume", r"объ[её]м\w*\s+и\s+вид\w+\s+(?:учебн\w+\s+)?работ"),
    ("_b_org", r"организационно-педагогическ\w+\s+услови"),
    ("_b_section6", r"перечень\s+учебно-?методическ\w*\s+и\s+информацион"),
    ("_b_printed_lit", r"печатн\w+\s+учебно-?методическ\w*\s+литератур"),
    ("learning_outcomes", r"планируем[ыо]е\s+результат\w*\s+обучен"),
    ("goals", r"цел[ьи]\s+и\s+задач\w+\s+дисциплин"),
    ("objects", r"изучаем[ыо]е\s+объект\w*"),
    ("requirements", r"входн[ыо]е\s+требован\w*|пререквизит"),
    ("content", r"содержан\w+\s+дисциплин|тематическ\w+\s+план"),
    ("topics_practice", r"тематик\w*\s+(?:примерных\s+|приблизительных\s+)?практическ"),
    ("topics_lab", r"тематик\w*\s+(?:примерных\s+|приблизительных\s+)?лабораторн"),
    ("educational_tech", r"образовательн\w+\s+технологи"),
    ("literature_methodical_students", r"методическ\w+\s+указан\w*.{0,40}освоен"),
    ("literature_methodical_self_study", r"(?:учебно-)?методическ\w+\s+обеспеч\w+.{0,40}самостоятельн\w+\s+работ"),
    ("methodical_recommendations", r"методическ\w+\s+(?:указани|рекомендаци)\w*\s+(?:для\s+)?(?:обуча|студент)"),
    ("literature_periodicals", r"периодическ\w+\s+издан"),
    ("literature_normative", r"нормативно-техническ\w+\s+издан|нормативно-правов\w+\s+документ"),
    ("literature_printed_additional", r"дополнительн\w+\s+литератур"),
    ("literature_additional_books", r"учебн\w+\s+и\s+научн\w+\s+издан"),
    ("literature_printed_main", r"основн\w+\s+литератур"),
    ("literature_electronic", r"электронн\w+\s+(?:учебно-методич|литератур|информацион)|электронные\s+ресурс|электронно-библиотечн"),
    ("databases", r"(?:соврем\w+\s+)?(?:професси\w+\s+)?баз[ыа]?\s+данных"),
    ("software", r"программн\w+\s+обеспеч"),
    ("material_tech", r"материально-техническ\w+\s+обеспеч"),
    ("fos", r"фонд\w*\s+оценочн\w+\s+средств|оценочн\w+\s+средств\w*\s+(?:для\s+проведени|по\s+дисциплин)"),
]

_UNNUMBERED_HEADING_KEYS = {"topics_practice", "topics_lab"}

_COMPILED_RULES = [(key, re.compile(pat, re.IGNORECASE)) for key, pat in _HEADING_RULES]

_NUMBER_PREFIX_RE = re.compile(r"^[\d]+(?:\.\d+)*\.?\s*")
_LEADING_PUNCT_RE = re.compile(r"^[\s\-—.«»\"'*#§№]+")

_PER_CHUNK_CHAR_CAP = 12000

_BOUNDARY_ONLY_KEYS = {"fos", "_b_general", "_b_volume", "_b_org", "_b_section6", "_b_printed_lit"}

_BULLET_CHARS = "-–—−•*‣·▪●◦"

_LOWER_START_RE = re.compile(r"^[a-zа-яё]")
_PAGENUM_RE = re.compile(r"^\d{1,3}$")


def _trim_body_lines(body_lines: list[str]) -> list[str]:
    out = list(body_lines)
    trimmed = 0
    while out and trimmed < 6:
        s = out[0].strip()
        if not s:
            out = out[1:]
            continue
        if len(s) < 130 and _LOWER_START_RE.match(s):
            out = out[1:]
            trimmed += 1
            continue
        break
    while out:
        s = out[-1].strip().strip("\x0c").strip()
        if s == "" or _PAGENUM_RE.match(s):
            out = out[:-1]
        else:
            break
    return out


def _classify_line(line: str) -> str | None:
    stripped = line.strip()
    if not stripped or len(stripped) > 250:
        return None
    if stripped[0] in _BULLET_CHARS:
        return None
    if stripped.endswith(";"):
        return None
    after_punct = _LEADING_PUNCT_RE.sub("", stripped)
    had_number = bool(_NUMBER_PREFIX_RE.match(after_punct))
    cleaned = _NUMBER_PREFIX_RE.sub("", after_punct)
    cleaned = _LEADING_PUNCT_RE.sub("", cleaned)
    if len(cleaned) < 6 or len(cleaned) > 110:
        return None
    if not cleaned[:1].isupper():
        return None
    if cleaned.endswith("."):
        cleaned = cleaned[:-1]
    for key, pattern in _COMPILED_RULES:
        if pattern.search(cleaned):
            if not had_number and key not in _UNNUMBERED_HEADING_KEYS:
                return None
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
        if key in _BOUNDARY_ONLY_KEYS:
            continue
        end_idx = matches[j + 1][0] if j + 1 < len(matches) else len(lines)
        body_lines = _trim_body_lines(lines[start_idx + 1:end_idx])
        body = "\n".join(body_lines).strip()
        body = re.sub(r"\n{3,}", "\n\n", body)
        if not body or len(body) < 3:
            continue
        if key in sections:
            continue
        sections[key] = body[:_PER_CHUNK_CHAR_CAP]
    return sections


async def extract_and_save_sections(db: AsyncSession, document_id: int, file_path: str) -> int:
    text = await extract_text_from_file(file_path, max_chars=None)
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
