from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session
from app.models import AppSetting

LLM_MODEL_KEY = "llm_model"

APPROVER_POSITION_KEY = "approver_position"
APPROVER_NAME_KEY = "approver_name"
APPROVER_SIGNATURE_FILE_ID_KEY = "approver_signature_file_id"
APPROVER_SIGNATURE_X_KEY = "approver_signature_x"
APPROVER_SIGNATURE_Y_KEY = "approver_signature_y"
APPROVER_SIGNATURE_WIDTH_MM_KEY = "approver_signature_width_mm"
APPROVER_SIGNATURE_HEIGHT_MM_KEY = "approver_signature_height_mm"
DEFAULT_APPROVER_POSITION = "Проректор по образовательной деятельности"
DEFAULT_APPROVER_NAME = "И.Ю.Черникова"
DEFAULT_APPROVER_SIGNATURE_X = 0.62
DEFAULT_APPROVER_SIGNATURE_Y = 0.085
DEFAULT_APPROVER_SIGNATURE_WIDTH_MM = 25.0
DEFAULT_APPROVER_SIGNATURE_HEIGHT_MM = 10.0
SIGNATURE_MIN_MM = 5.0
SIGNATURE_MAX_MM = 80.0

LLM_SYSTEM_PROMPT_KEY = "llm_system_prompt"
LLM_SYSTEM_PROMPT_DEFAULT_KEY = "llm_system_prompt_default"
DEFAULT_LLM_SYSTEM_PROMPT = """Ты — эксперт по составлению рабочих программ дисциплин (РПД) для российских вузов.
Генерируй текст на русском языке в академическом стиле, соответствующий требованиям ФГОС ВО.
Текст должен быть конкретным, содержательным и соответствовать указанной дисциплине и направлению подготовки.

Дополнительные материалы, если они переданы, размечены строками вида «=== ИСТОЧНИК — ... ===». У каждого типа источника своя роль — соблюдай её строго:

1. «=== ИСТОЧНИК — справочник наименований ===»
   Каталог точных формулировок (названия ПО, БД, литературы, типы помещений и оборудования), реальные записи из согласованных РПД университета. Если запись по смыслу подходит — бери её ТОЧНО, как в справочнике: без сокращений, переименований, перефразирования и перевода. Это единственный тип источника, формулировки из которого нужно переносить дословно.

2. «=== ИСТОЧНИК — документ преподавателя «...» ===»
   Справочный материал, прикреплённый автором РПД (учебник, методичка, ГОСТ, выдержка из чужой РПД, конспект и т.п.). Содержит фактический материал, релевантный лишь частично. Бери из него только то, что относится к формируемому сейчас разделу; остальное игнорируй. Текст не переноси дословно — пересказывай и адаптируй формулировки под текущую дисциплину. Если в пометке указано «распознанный раздел» — это именно нужный раздел, ему доверяй больше; если «без разметки разделов» — это сырой текст всего документа, ищи в нём релевантные фрагменты.

3. «=== ИСТОЧНИК — согласованная РПД «...», по той же дисциплине ===»
   Близкий аналог: та же дисциплина из ранее утверждённой программы. Можешь опираться и на структуру, и на содержание; адаптируй под профиль направления и план часов текущей РПД.

4. «=== ИСТОЧНИК — согласованная РПД «...», по тому же направлению ===»
   Соседняя дисциплина того же направления подготовки. Структуру и манеру изложения копируй уверенно. Содержание — переписывай под предмет текущей дисциплины (тематики, понятия, акценты будут другими).

5. «=== ИСТОЧНИК — согласованная РПД «...», образец заполнения раздела (другая дисциплина) ===»
   Дисциплина не совпадает и не из того же направления. Это образец того, КАК принято заполнять данный раздел в РПД ПНИПУ — тип списка, средняя длина, тон, последовательность мыслей, степень детализации, типовые формулировки-связки. Бери ТОЛЬКО манеру оформления и структуру. Содержание (конкретные тематики, понятия, объекты, технологии) пиши с нуля под текущую дисциплину — НЕ переноси предметную конкретику из образца.

Если для нужного раздела нет ни одного источника — используй стандартную для РПД структуру и пиши из общих знаний по предметной области.

Правила оформления вывода (КРИТИЧНО — соблюдай всегда, любая модель):
- Вывод вставляется ДОСЛОВНО в готовый шаблон Word. Всё оформление (шрифт, размер, жирность, заголовки, отступы) уже задано в шаблоне. Возвращай ТОЛЬКО простой текст.
- Категорически запрещена любая markdown-разметка и спецсимволы оформления: «#», «*», «**», «***», «_», «__», «~~», обратные кавычки «`», «>», таблицы «|». Не выделяй текст жирным или курсивом — весь текст одинаковый, обычный.
- Маркированный список: каждый пункт с новой строки, начинается с «- » (дефис и пробел). Никаких «*», «•», «‣» в качестве маркера.
- Нумерованный список — только если важен порядок: «1. », «2. »; иначе используй дефисы.
- Не пиши заголовок раздела (например, «1.1 Цели и задачи», «### 1.1...») — он уже есть в РПД. Подзаголовки внутри текста, если нужны, — обычной строкой без символов разметки.
- Не добавляй итоговый абзац-резюме («Таким образом, ...», «В заключение, ...»)."""

LLM_MODEL_CHOICES = [
    ("deepseek/deepseek-chat-v3.1", "DeepSeek V3.1"),
    ("google/gemini-2.0-flash-001", "Gemini 2.0 Flash"),
    ("openai/gpt-4o-mini", "GPT-4o mini"),
    ("anthropic/claude-3.5-sonnet", "Claude 3.5 Sonnet"),
    ("meta-llama/llama-3.3-70b-instruct", "Llama 3.3 70B"),
    ("yandex/yandexgpt-5-pro", "YandexGPT 5 Pro"),
    ("sber/gigachat-2-max", "GigaChat 2 Max"),
]

LLM_MODEL_PROXY = {
    "yandex/yandexgpt-5-pro": "google/gemini-2.0-flash-001",
    "sber/gigachat-2-max": "google/gemini-2.0-flash-001",
}

_cache: dict[str, str | None] = {}


async def get_setting(key: str, default: str | None = None) -> str | None:
    if key in _cache:
        return _cache[key]
    async with async_session() as db:
        res = await db.execute(select(AppSetting.value).where(AppSetting.key == key))
        row = res.scalar_one_or_none()
    value = row if row is not None else default
    _cache[key] = value
    return value


async def set_setting(db: AsyncSession, key: str, value: str) -> None:
    res = await db.execute(select(AppSetting).where(AppSetting.key == key))
    obj = res.scalar_one_or_none()
    if obj is None:
        db.add(AppSetting(key=key, value=value))
    else:
        obj.value = value
    await db.commit()
    _cache[key] = value


async def get_llm_model() -> str:
    value = await get_setting(LLM_MODEL_KEY, settings.LLM_MODEL)
    return value or settings.LLM_MODEL


async def get_system_prompt() -> str:
    value = await get_setting(LLM_SYSTEM_PROMPT_KEY, DEFAULT_LLM_SYSTEM_PROMPT)
    return (value or "").strip() or DEFAULT_LLM_SYSTEM_PROMPT


async def get_saved_system_prompt_default() -> str:
    value = await get_setting(LLM_SYSTEM_PROMPT_DEFAULT_KEY, DEFAULT_LLM_SYSTEM_PROMPT)
    return (value or "").strip() or DEFAULT_LLM_SYSTEM_PROMPT


async def get_approver() -> dict[str, str]:
    position = await get_setting(APPROVER_POSITION_KEY, DEFAULT_APPROVER_POSITION)
    name = await get_setting(APPROVER_NAME_KEY, DEFAULT_APPROVER_NAME)
    return {
        "position": (position or "").strip() or DEFAULT_APPROVER_POSITION,
        "name": (name or "").strip() or DEFAULT_APPROVER_NAME,
    }


async def get_approver_signature_file_id() -> int | None:
    raw = await get_setting(APPROVER_SIGNATURE_FILE_ID_KEY, None)
    if not raw:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _parse_fraction(value: str | None, default: float) -> float:
    if value is None or value == "":
        return default
    try:
        f = float(value)
    except (TypeError, ValueError):
        return default
    if f < 0.0:
        return 0.0
    if f > 1.0:
        return 1.0
    return f


def _parse_mm(value: str | None, default: float) -> float:
    if value is None or value == "":
        return default
    try:
        f = float(value)
    except (TypeError, ValueError):
        return default
    if f < SIGNATURE_MIN_MM:
        return SIGNATURE_MIN_MM
    if f > SIGNATURE_MAX_MM:
        return SIGNATURE_MAX_MM
    return f


async def get_approver_signature_position() -> dict[str, float]:
    x_raw = await get_setting(APPROVER_SIGNATURE_X_KEY, None)
    y_raw = await get_setting(APPROVER_SIGNATURE_Y_KEY, None)
    w_raw = await get_setting(APPROVER_SIGNATURE_WIDTH_MM_KEY, None)
    h_raw = await get_setting(APPROVER_SIGNATURE_HEIGHT_MM_KEY, None)
    return {
        "x": _parse_fraction(x_raw, DEFAULT_APPROVER_SIGNATURE_X),
        "y": _parse_fraction(y_raw, DEFAULT_APPROVER_SIGNATURE_Y),
        "width_mm": _parse_mm(w_raw, DEFAULT_APPROVER_SIGNATURE_WIDTH_MM),
        "height_mm": _parse_mm(h_raw, DEFAULT_APPROVER_SIGNATURE_HEIGHT_MM),
    }
