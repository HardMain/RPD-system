import time
import hashlib
from openai import AsyncOpenAI
from app.core.config import settings

client = AsyncOpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_BASE_URL)

SYSTEM_PROMPT = """Ты — эксперт по составлению рабочих программ дисциплин (РПД) для российских вузов.
Генерируй текст на русском языке в академическом стиле, соответствующий требованиям ФГОС ВО.
Текст должен быть конкретным, содержательным и соответствовать указанной дисциплине и направлению подготовки."""

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

async def extract_text_from_file(file_path: str) -> str:
    import os
    if not os.path.exists(file_path):
        return ""

    ext = os.path.splitext(file_path)[1].lower()
    try:
        if ext == ".txt":
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()[:5000]

        elif ext == ".docx":
            from docx import Document
            doc = Document(file_path)
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            return text[:5000]

        elif ext == ".pdf":
            import subprocess
            result = subprocess.run(
                ["pdftotext", "-layout", file_path, "-"],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode == 0:
                return result.stdout[:5000]
            return ""
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
    user_prompt_template_override: str | None = None,
    system_prompt_override: str | None = None,
) -> dict:
    prompt_template = user_prompt_template_override or SECTION_PROMPTS.get(section)
    if not prompt_template:
        return {"generated_text": "", "model": "none", "tokens_used": 0, "generation_time_ms": 0}

    prompt = prompt_template.format(
        discipline=discipline, direction=direction, profile=profile or "",
        total_hours=total_hours, lecture_hours=lecture_hours,
        practice_hours=practice_hours, lab_hours=lab_hours,
        self_study_hours=self_study_hours,
    )
    if extra_context:
        prompt += f"\n\nДополнительный контекст из загруженных материалов:\n{extra_context[:4000]}"

    prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()[:16]
    system_message = system_prompt_override if system_prompt_override is not None else SYSTEM_PROMPT

    start = time.time()
    try:
        if settings.LLM_API_KEY == "demo":
            raise Exception("Demo mode — using fallback")

        response = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=2000,
        )
        text = response.choices[0].message.content
        tokens = response.usage.total_tokens if response.usage else 0
        model = settings.LLM_MODEL
    except Exception:
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
