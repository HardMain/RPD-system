import os
import re
import sys
import time
import asyncio
import hashlib
from openai import AsyncOpenAI
from app.core.config import settings
from app.services.app_settings import get_llm_model, get_system_prompt

LLM_DEBUG = os.getenv("LLM_DEBUG", "").lower() in ("1", "true", "yes", "on")

client = AsyncOpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_BASE_URL)

_llm_semaphore = asyncio.Semaphore(max(1, settings.LLM_MAX_CONCURRENCY))

CONTEXT_CHAR_LIMIT = 12000
WHOLE_DOC_CHAR_LIMIT = 8000

DEFAULT_TEMPERATURE = 0.7
FACTUAL_TEMPERATURE = 0.2

_LOW_TEMPERATURE_SECTIONS = {
    "literature_printed_main",
    "literature_printed_additional",
    "literature_periodicals",
    "literature_normative",
    "literature_methodical_students",
    "literature_methodical_self_study",
    "literature_electronic",
    "software",
    "databases",
    "material_tech",
}


def _temperature_for(section: str) -> float:
    return FACTUAL_TEMPERATURE if section in _LOW_TEMPERATURE_SECTIONS else DEFAULT_TEMPERATURE


_MD_HEADER_RE = re.compile(r"^\s*#{1,6}\s+.+$", re.MULTILINE)
_BOLD_LINE_RE = re.compile(r"^\s*\*{2,3}[^*\n]{1,120}\*{2,3}\s*$", re.MULTILINE)


def _strip_markdown(text: str) -> str:
    text = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", text)
    text = re.sub(r"\*\*\*([^*\n]+?)\*\*\*", r"\1", text)
    text = re.sub(r"\*\*([^*\n]+?)\*\*", r"\1", text)
    text = re.sub(r"___([^_\n]+?)___", r"\1", text)
    text = re.sub(r"__([^_\n]+?)__", r"\1", text)
    text = re.sub(r"~~([^~\n]+?)~~", r"\1", text)
    text = re.sub(r"`([^`\n]+?)`", r"\1", text)
    text = re.sub(r"(?m)^(\s*)[*+•‣–—]\s+", r"\1- ", text)
    text = re.sub(r"(?m)^(\s*)-\s+", r"\1- ", text)
    text = text.replace("**", "").replace("__", "").replace("***", "")
    return text


def _clean_llm_output(text: str) -> str:
    if not text:
        return text
    text = text.strip()
    while True:
        first_line, sep, rest = text.partition("\n")
        first = first_line.strip()
        if not first:
            text = rest.lstrip()
            continue
        if _MD_HEADER_RE.match(first) or _BOLD_LINE_RE.match(first):
            text = rest.lstrip()
            continue
        if re.match(r"^\d+(\.\d+)*\.?\s+[А-ЯЁA-Z][^.]{2,80}$", first):
            text = rest.lstrip()
            continue
        break
    text = _strip_markdown(text)
    return text.strip()

SECTION_PROMPTS = {
    "goals": (
        "Сформулируй раздел «Цели и задачи дисциплины» для РПД.\n"
        "Включи: цель изучения дисциплины (1 абзац) и задачи (список из 5-7 пунктов).\n"
        "Дисциплина: {discipline}\nНаправление: {direction}\nПрофиль: {profile}"
    ),
    "tasks": (
        "Сформулируй задачи учебной дисциплины для РПД (5-7 задач в виде списка).\n"
        "Дисциплина: {discipline}\nНаправление: {direction}"
    ),
    "objects": (
        "Сформулируй раздел «Изучаемые объекты дисциплины» для РПД.\n"
        "Перечисли основные понятия, объекты и области, изучаемые в рамках дисциплины.\n"
        "Дисциплина: {discipline}\nНаправление: {direction}"
    ),
    "requirements": (
        "Сформулируй раздел «Входные требования» (пререквизиты) для РПД.\n"
        "Укажи, какие дисциплины должны быть изучены до начала данного курса и какие компетенции необходимы.\n"
        "Дисциплина: {discipline}\nНаправление: {direction}"
    ),
    "educational_tech": (
        "Сформулируй раздел «Образовательные технологии» для РПД.\n"
        "Опиши используемые технологии и методы обучения: лекции, лабораторные, проектная работа и т.д.\n"
        "Дисциплина: {discipline}\nНаправление: {direction}\n"
        "Часы: лекции {lecture_hours}, практики {practice_hours}, лабораторные {lab_hours}, СРС {self_study_hours}"
    ),
    "methodical_recommendations": (
        "Сформулируй раздел «Методические рекомендации для обучающихся» для РПД.\n"
        "Включи рекомендации по подготовке к лекциям, лабораторным, самостоятельной работе.\n"
        "Дисциплина: {discipline}\nНаправление: {direction}"
    ),
    "content": (
        "Сгенерируй содержание дисциплины: список из 8-12 разделов (тем) с кратким описанием каждого.\n"
        "Для каждого раздела укажи:\n- Название раздела\n- Краткое содержание (1-2 предложения)\n"
        "- Рекомендуемые часы: лекции, практики, лабораторные, СРС\n\n"
        "Формат ответа — JSON массив:\n"
        '[{{"title": "...", "brief_content": "...", "lecture_hours": N, "practice_hours": N, "lab_hours": N, "self_study_hours": N}}]\n\n'
        "Дисциплина: {discipline}\nНаправление: {direction}\n"
        "Всего часов: {total_hours}, лекции: {lecture_hours}, практики: {practice_hours}, "
        "лабораторные: {lab_hours}, СРС: {self_study_hours}"
    ),
    "topics": (
        "Сгенерируй тематики практических и лабораторных занятий для дисциплины.\n"
        "Формат ответа — JSON массив:\n"
        '[{{"topic_type": "Практика"|"Лабораторная", "title": "...", "hours": N, "description": "..."}}]\n\n'
        "Дисциплина: {discipline}\nНаправление: {direction}\n"
        "Часы практик: {practice_hours}, часы лабораторных: {lab_hours}"
    ),
    "literature": (
        "Предложи список основной и дополнительной литературы для дисциплины (5-8 источников).\n"
        "Формат ответа — JSON массив:\n"
        '[{{"source_type": "Основная"|"Дополнительная", "title": "...", "authors": "...", "year": YYYY, "publisher": "..."}}]\n\n'
        "Дисциплина: {discipline}\nНаправление: {direction}"
    ),
    "learning_outcomes": (
        "Сгенерируй результаты обучения по дисциплине, привязанные к компетенциям.\n"
        "Для каждого индикатора сформулируй конкретный результат обучения и средство оценки.\n"
        "Формат: текст с привязкой к индикаторам.\n"
        "Дисциплина: {discipline}\nНаправление: {direction}"
    ),
}

FALLBACK = {
    "goals": (
        "Целью изучения дисциплины «{discipline}» является формирование у обучающихся "
        "систематизированных знаний и практических навыков в данной предметной области, "
        "развитие компетенций, необходимых для профессиональной деятельности по направлению «{direction}».\n\n"
        "Задачи дисциплины:\n"
        "- изучение теоретических основ дисциплины;\n"
        "- формирование практических умений и навыков;\n"
        "- развитие способности к самостоятельной работе;\n"
        "- формирование навыков применения полученных знаний в профессиональной деятельности;\n"
        "- развитие аналитического мышления."
    ),
    "tasks": (
        "Задачи дисциплины «{discipline}»:\n"
        "- изучение теоретических основ;\n"
        "- формирование практических умений;\n"
        "- развитие навыков самостоятельной работы;\n"
        "- формирование навыков применения знаний;\n"
        "- развитие аналитического мышления."
    ),
    "objects": "Объектами изучения дисциплины «{discipline}» являются основные понятия, методы и технологии данной предметной области.",
    "requirements": "Для изучения дисциплины «{discipline}» обучающийся должен владеть базовыми знаниями, полученными при изучении дисциплин предшествующих семестров.",
    "educational_tech": "При реализации дисциплины «{discipline}» используются следующие образовательные технологии: лекции с мультимедийным сопровождением, практические и лабораторные занятия, самостоятельная работа студентов.",
    "methodical_recommendations": "Обучающимся рекомендуется регулярно посещать занятия, выполнять задания в установленные сроки, использовать рекомендованную литературу для подготовки.",
}

async def extract_text_from_file(file_path: str, max_chars: int | None = WHOLE_DOC_CHAR_LIMIT) -> str:
    import os
    if not os.path.exists(file_path):
        return ""

    def _cap(s: str) -> str:
        return s if max_chars is None else s[:max_chars]

    ext = os.path.splitext(file_path)[1].lower()
    try:
        if ext == ".txt":
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return _cap(f.read())

        elif ext == ".docx":
            from docx import Document
            doc = Document(file_path)
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            return _cap(text)

        elif ext == ".pdf":
            text = ""
            try:
                import fitz
                with fitz.open(file_path) as doc:
                    parts = []
                    for page in doc:
                        parts.append(page.get_text("text", sort=True))
                    text = "\n".join(parts).strip()
            except Exception:
                text = ""
            if not text:
                import subprocess
                try:
                    result = subprocess.run(
                        ["pdftotext", "-layout", file_path, "-"],
                        capture_output=True, text=True, timeout=60,
                    )
                    if result.returncode == 0:
                        text = result.stdout
                except Exception:
                    text = ""
            return _cap(text or "")
        else:
            return ""
    except Exception:
        return ""

async def generate_section(
    section: str,
    discipline: str,
    direction: str,
    profile: str = "",
    total_hours: int = 0,
    lecture_hours: int = 0,
    practice_hours: int = 0,
    lab_hours: int = 0,
    self_study_hours: int = 0,
    extra_context: str = "",
    semesters_plan: str = "",
    assessment_tools: str = "",
    user_prompt_template_override: str | None = None,
    system_prompt_override: str | None = None,
) -> dict:
    prompt_template = user_prompt_template_override or SECTION_PROMPTS.get(section)
    if not prompt_template:
        return {"generated_text": "", "model": "none", "tokens_used": 0, "generation_time_ms": 0}

    from collections import defaultdict
    fmt_vars = defaultdict(str, {
        "discipline": discipline, "direction": direction, "profile": profile or "",
        "total_hours": total_hours, "lecture_hours": lecture_hours,
        "practice_hours": practice_hours, "lab_hours": lab_hours,
        "self_study_hours": self_study_hours,
        "semesters_plan": semesters_plan,
        "assessment_tools": assessment_tools,
    })
    prompt = prompt_template.format_map(fmt_vars)
    if extra_context:
        prompt += (
            "\n\nНиже — дополнительные материалы. Каждый блок начинается со строки "
            "«=== ИСТОЧНИК — ... ===» с пометкой типа и происхождения. Применяй их строго "
            "согласно правилам в системной инструкции для соответствующего типа источника:\n"
            + extra_context[:CONTEXT_CHAR_LIMIT]
        )

    prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()[:16]
    system_message = system_prompt_override if system_prompt_override is not None else await get_system_prompt()

    temperature = _temperature_for(section)

    if LLM_DEBUG:
        bar = "=" * 100
        print(f"\n{bar}", file=sys.stderr, flush=True)
        print(f"[LLM DEBUG] section={section!r} discipline={discipline!r} direction={direction!r} temperature={temperature}", file=sys.stderr, flush=True)
        print(f"[LLM DEBUG] prompt_hash={prompt_hash} prompt_len={len(prompt)} extra_ctx_len={len(extra_context)}", file=sys.stderr, flush=True)
        print(f"{bar}\n--- SYSTEM MESSAGE ---", file=sys.stderr, flush=True)
        print(system_message, file=sys.stderr, flush=True)
        print(f"--- USER MESSAGE ---", file=sys.stderr, flush=True)
        print(prompt, file=sys.stderr, flush=True)
        print(f"{bar}\n", file=sys.stderr, flush=True)

    start = time.time()
    try:
        if settings.LLM_API_KEY == "demo":
            raise Exception("Demo mode — using fallback")

        current_model = await get_llm_model()
        async with _llm_semaphore:
            response = await client.chat.completions.create(
                model=current_model,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt},
                ],
                temperature=temperature,
                max_tokens=2000,
            )
        raw_text = response.choices[0].message.content
        text = _clean_llm_output(raw_text)
        tokens = response.usage.total_tokens if response.usage else 0
        model = getattr(response, "model", None) or current_model
        if LLM_DEBUG:
            bar = "=" * 100
            print(f"\n{bar}\n[LLM DEBUG] RESPONSE for section={section!r} model={model} tokens={tokens}", file=sys.stderr, flush=True)
            print(raw_text, file=sys.stderr, flush=True)
            print(f"{bar}\n", file=sys.stderr, flush=True)
    except Exception as exc:
        if LLM_DEBUG:
            print(f"[LLM DEBUG] FALLBACK for section={section!r} reason={exc!r}", file=sys.stderr, flush=True)
        fallback_tmpl = FALLBACK.get(section, "Раздел «{discipline}» — текст для заполнения.")
        text = fallback_tmpl.format(discipline=discipline, direction=direction)
        tokens = 0
        model = "fallback"

    elapsed = int((time.time() - start) * 1000)
    return {
        "generated_text": text,
        "model": model,
        "tokens_used": tokens,
        "generation_time_ms": elapsed,
        "prompt_hash": prompt_hash,
    }
