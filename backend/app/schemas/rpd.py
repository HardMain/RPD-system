"""RPD schemas: top-level CRUD, child collections (sections/topics/literature/
software/material-tech/databases/outcomes/developers), uploaded docs, list/detail
projections, approval/LLM payloads."""
from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime


# ── RPD top-level ─────────────────────────────────────────────────────────────
class RpdCreate(BaseModel):
    """Создание РПД.

    Поведение:
    - Если передан `bup_discipline_ids` — РПД привязывается к этим БУП-дисциплинам;
      `id_discipline` берётся автоматически из первой (для совместимости с FK).
    - Если передан только `id_discipline` — РПД авто-привязывается ко всем
      `BupDiscipline`, у которых эта же логическая дисциплина.
    - Можно передать оба: тогда `bup_discipline_ids` имеет приоритет.
    """
    id_discipline: int | None = None
    bup_discipline_ids: list[int] = []
    academic_year: str
    based_on_rpd_id: int | None = None


class OutcomeUpsert(BaseModel):
    """Upsert одной строки в таблице планируемых результатов.

    Идентификация записи:
      • `id_outcome` — приоритет (для строк со snapshot, где живого индикатора уже нет).
      • `id_indicator` — fallback (для строк с живым индикатором).

    `outcome_text == "" and assessment_tool == ""` НЕ удаляет запись — после
    «вшивания» компетенций в РПД при создании пустая строка остаётся видимой
    в таблице раздела 2, преподаватель должен иметь возможность очистить и
    оставить пустой. Если хочется удалить — отдельный DELETE-эндпоинт."""
    id_outcome: int | None = None
    id_indicator: int | None = None
    outcome_text: str = ""
    assessment_tool: str = ""


class FosFileOut(BaseModel):
    """Прикреплённый к РПД файл ФОС."""
    id_rpd_fos: int
    id_file: int
    role: str           # 'main' | 'other'
    name: str | None = None
    comment: str | None = None
    original_name: str
    size_bytes: int | None = None

    class Config:
        from_attributes = True


class FosFileSelect(BaseModel):
    """Выбрать существующий файл из хранилища (если уже загружен ранее)."""
    id_file: int
    role: str = "other"
    name: str | None = None
    comment: str | None = None


class OutcomeRowOut(BaseModel):
    """Строка таблицы планируемых результатов: индикатор + (опц.) запись.

    `id_indicator` может быть None — если живого индикатора в БУПе уже нет
    (БУП удалён, индикатор уехал вместе с осиротевшей компетенцией). Тогда
    идентификация — через `id_outcome`."""
    id_indicator: int | None = None
    indicator_code: str
    indicator_description: str
    competency_code: str
    competency_name: str
    id_outcome: int | None = None
    outcome_text: str | None = None
    assessment_tool: str | None = None


class RpdUpdate(BaseModel):
    goals_text: str | None = None
    tasks_text: str | None = None
    objects_text: str | None = None
    requirements_text: str | None = None
    educational_tech: str | None = None
    methodical_recommendations: str | None = None
    comment: str | None = None


# ── Sections / Topics ─────────────────────────────────────────────────────────
class RpdTopicOut(BaseModel):
    id_topic: int
    id_section: int
    topic_type: str
    title: str
    hours: int | None = None
    description: str | None = None

    class Config:
        from_attributes = True


class RpdTopicCreate(BaseModel):
    topic_type: str
    title: str
    hours: int | None = None
    description: str | None = None


class RpdTopicUpdate(BaseModel):
    topic_type: str | None = None
    title: str | None = None
    hours: int | None = None
    description: str | None = None


class RpdSectionOut(BaseModel):
    id_section: int
    section_number: int
    title: str
    brief_content: str | None = None
    lecture_hours: int
    practice_hours: int
    lab_hours: int
    self_study_hours: int
    semester: int | None = None
    topics: list[RpdTopicOut] = []

    class Config:
        from_attributes = True


class RpdSectionCreate(BaseModel):
    section_number: int
    title: str
    brief_content: str | None = None
    lecture_hours: int = 0
    practice_hours: int = 0
    lab_hours: int = 0
    self_study_hours: int = 0
    semester: int | None = None


# ── Literature ────────────────────────────────────────────────────────────────
# `availability` — список названий ЭБС, в которых доступна электронная литература
# (multi-select на фронте). Передаётся как list[str], в БД хранится JSON-строкой.
class LiteratureCreate(BaseModel):
    source_type: str
    title: str
    url: str | None = None
    copies_count: int | None = None
    availability: list[str] | None = None


class LiteratureUpdate(BaseModel):
    source_type: str | None = None
    title: str | None = None
    url: str | None = None
    copies_count: int | None = None
    availability: list[str] | None = None


class LiteratureOut(BaseModel):
    id_literature: int
    source_type: str
    title: str
    url: str | None = None
    copies_count: int | None = None
    # JSONB-колонка может быть NULL для старых записей или для печатной литературы
    # — в этом случае на фронт отдадим пустой массив.
    availability: list[str] | None = None
    # Legacy-поля — оставлены чтобы старые сохранённые РПД ещё открывались. UI
    # их игнорирует.
    authors: str | None = None
    year: int | None = None
    publisher: str | None = None

    class Config:
        from_attributes = True


# ── Software ──────────────────────────────────────────────────────────────────
class SoftwareCreate(BaseModel):
    name: str
    # Вид ПО (бывшее license_type — переименовано на фронте, на бэке колонка
    # сохраняет имя).
    license_type: str | None = None


class SoftwareOut(BaseModel):
    id_software: int
    name: str
    license_type: str | None = None
    # Legacy-поле, в UI больше не используется.
    purpose: str | None = None

    class Config:
        from_attributes = True


# ── Material-Tech ─────────────────────────────────────────────────────────────
class MaterialTechCreate(BaseModel):
    room_type: str
    equipment: str | None = None
    quantity: int | None = None


class MaterialTechOut(BaseModel):
    id_material_tech: int
    room_type: str
    equipment: str | None = None
    quantity: int | None = None

    class Config:
        from_attributes = True


# ── Databases ─────────────────────────────────────────────────────────────────
class DatabaseCreate(BaseModel):
    name: str
    db_type: str | None = None


class DatabaseOut(BaseModel):
    id_database: int
    name: str
    db_type: str | None = None
    # Legacy-поле, в UI больше не используется.
    url: str | None = None

    class Config:
        from_attributes = True


# ── Learning outcomes ─────────────────────────────────────────────────────────
class LearningOutcomeCreate(BaseModel):
    id_indicator: int
    outcome_text: str | None = None
    assessment_tool: str | None = None


class LearningOutcomeOut(BaseModel):
    id_outcome: int
    # `id_indicator` может быть None после hard-delete БУПа: компетенция и
    # индикатор уехали, но snapshot (`indicator_code`, `competency_code`)
    # сохранён в самой записи outcome.
    id_indicator: int | None = None
    indicator_code: str | None = None
    competency_code: str | None = None
    outcome_text: str | None = None
    assessment_tool: str | None = None

    class Config:
        from_attributes = True


# ── Developers / uploads ──────────────────────────────────────────────────────
class DeveloperOut(BaseModel):
    id_rpd_developer: int
    id_user: int
    full_name: str

    class Config:
        from_attributes = True


class UploadedDocumentOut(BaseModel):
    id_document: int
    filename: str
    file_type: str
    file_size: int | None = None
    uploaded_at: datetime | None = None

    class Config:
        from_attributes = True


# ── Approval ──────────────────────────────────────────────────────────────────
class ApprovalAction(BaseModel):
    action: str  # approve / reject
    comment: str | None = None


class ApprovalOut(BaseModel):
    id_approval: int
    stage: str
    status: str
    comment: str | None = None
    reviewer_name: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


# ── LLM ───────────────────────────────────────────────────────────────────────
class LlmGenerateRequest(BaseModel):
    section: str
    context: str | None = None


class LlmGenerateResponse(BaseModel):
    section: str
    generated_text: str
    model: str
    tokens_used: int | None = None


# ── List / detail projections ─────────────────────────────────────────────────
class RpdListOut(BaseModel):
    id_rpd: int
    discipline_name: str
    direction_name: str
    direction_code: str
    academic_year: str
    status: str
    author_name: str
    semester: str | None = None
    total_hours: int | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class BupDisciplineRefOut(BaseModel):
    """Краткие данные БУП-дисциплины, прикреплённой к РПД (для шапки часов).

    `id_bup_discipline` / `id_bup` могут быть None, если БУП был hard-удалён —
    данные тогда отдаются из snapshot самой привязки. `bup_deleted=true` в этом
    случае.
    """
    id_bup_discipline: int | None = None
    id_bup: int | None = None
    bup_name: str
    code: str | None = None
    semester: str | None = None
    control_form: str | None = None
    total_hours: int | None = None
    lecture_hours: int | None = None
    lab_hours: int | None = None
    practice_hours: int | None = None
    ksr_hours: int | None = None
    self_study_hours: int | None = None
    zet: int | None = None
    direction_code: str | None = None
    direction_name: str | None = None
    direction_profile: str | None = None
    fgos_file_id: int | None = None
    fgos_file_name: str | None = None
    # Часы по каждому семестру дисциплины (как в XLS-блоках C16-C55).
    # Список dict'ов {number, lecture, lab, practice, ksr, srs}. Пустые ячейки
    # хранятся как null, чтобы шаблон раздела 3 рисовал их пустыми, а не «0».
    # Может быть None, если БУП был импортирован до этой правки — UI/шаблон
    # тогда рендерят один семестр из агрегатных полей.
    semesters_data: list[dict] | None = None
    # БУП был soft-удалён администратором: показываем bup-дисциплину как обычно,
    # но рядом с именем плана можно подсказать пользователю «БУП удалён из БД».
    bup_deleted: bool = False


class RpdDetailOut(BaseModel):
    id_rpd: int
    id_discipline: int
    discipline_name: str
    discipline_code: str | None = None
    direction_name: str
    direction_code: str
    direction_profile: str | None = None
    academic_year: str
    status: str
    bup_disciplines: list[BupDisciplineRefOut] = []
    goals_text: str | None = None
    tasks_text: str | None = None
    objects_text: str | None = None
    requirements_text: str | None = None
    educational_tech: str | None = None
    methodical_recommendations: str | None = None
    comment: str | None = None
    author_name: str
    semester: str | None = None
    total_hours: int | None = None
    lecture_hours: int | None = None
    practice_hours: int | None = None
    lab_hours: int | None = None
    self_study_hours: int | None = None
    control_form: str | None = None
    fos_main: FosFileOut | None = None
    fos_other: list[FosFileOut] = []
    sections: list[RpdSectionOut] = []
    literature: list[LiteratureOut] = []
    software: list[SoftwareOut] = []
    material_tech: list[MaterialTechOut] = []
    databases: list[DatabaseOut] = []
    learning_outcomes: list[LearningOutcomeOut] = []
    developers: list[DeveloperOut] = []
    uploaded_documents: list[UploadedDocumentOut] = []
    approvals: list[ApprovalOut] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
