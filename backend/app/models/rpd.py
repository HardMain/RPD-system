"""RPD-domain models: the РПД itself plus all child collections (sections,
topics, literature, software, material-tech, databases, learning outcomes,
developers, uploaded documents, LLM logs, approval stages)."""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, SmallInteger
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Rpd(Base):
    __tablename__ = "rpd"
    id_rpd = Column(Integer, primary_key=True, autoincrement=True)
    id_discipline = Column(Integer, ForeignKey("disciplines.id_discipline"), nullable=False)
    id_author = Column(Integer, ForeignKey("users.id_user"), nullable=False)
    academic_year = Column(String(9), nullable=False)
    status = Column(String(30), nullable=False, default="Черновик")
    goals_text = Column(Text)
    tasks_text = Column(Text)
    objects_text = Column(Text)
    requirements_text = Column(Text)
    educational_tech = Column(Text)
    methodical_recommendations = Column(Text)
    comment = Column(Text)  # «Комментарий к РПД» из АРМ — произвольная заметка для разработчика
    based_on_rpd_id = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    discipline = relationship("Discipline", back_populates="rpds")
    author = relationship("User", foreign_keys=[id_author])
    bup_links = relationship("RpdBupDiscipline", back_populates="rpd", cascade="all, delete-orphan")
    developers = relationship("RpdDeveloper", back_populates="rpd", cascade="all, delete-orphan")
    sections = relationship("RpdSection", back_populates="rpd", cascade="all, delete-orphan",
                            order_by="RpdSection.section_number")
    # Везде явный order_by по PK — иначе после UPDATE строки могут «всплывать»
    # в произвольной позиции (MVCC в postgres), и при inline-редактировании в
    # таблицах разделов 6.1/6.2 / 7 / 4 визуально кажется, что строки меняются
    # местами (React по key корректно держит данные внутри строк, но строки
    # переезжают). Стабильный порядок чтения чинит это и для всех аналогичных
    # «таблиц-редакторов».
    literature = relationship("RpdLiterature", back_populates="rpd", cascade="all, delete-orphan",
                              order_by="RpdLiterature.id_literature")
    software = relationship("RpdSoftware", back_populates="rpd", cascade="all, delete-orphan",
                            order_by="RpdSoftware.id_software")
    material_tech = relationship("RpdMaterialTech", back_populates="rpd", cascade="all, delete-orphan",
                                 order_by="RpdMaterialTech.id_material_tech")
    databases = relationship("RpdDatabase", back_populates="rpd", cascade="all, delete-orphan",
                             order_by="RpdDatabase.id_database")
    learning_outcomes = relationship("RpdLearningOutcome", back_populates="rpd", cascade="all, delete-orphan",
                                     order_by="RpdLearningOutcome.id_outcome")
    topics = relationship("RpdTopic", back_populates="rpd", cascade="all, delete-orphan",
                          order_by="RpdTopic.id_topic")
    fos_files = relationship("RpdFosFile", back_populates="rpd", cascade="all, delete-orphan")
    uploaded_documents = relationship("UploadedDocument", back_populates="rpd", cascade="all, delete-orphan")
    llm_logs = relationship("LlmGenerationLog", back_populates="rpd", cascade="all, delete-orphan")
    approvals = relationship("ApprovalStage", back_populates="rpd", cascade="all, delete-orphan",
                             order_by="ApprovalStage.created_at.desc()")


class RpdDeveloper(Base):
    __tablename__ = "rpd_developers"
    id_rpd_developer = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    id_user = Column(Integer, ForeignKey("users.id_user"), nullable=False)

    rpd = relationship("Rpd", back_populates="developers")
    user = relationship("User")


class RpdSection(Base):
    __tablename__ = "rpd_sections"
    id_section = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    section_number = Column(SmallInteger, nullable=False)
    title = Column(String(300), nullable=False)
    brief_content = Column(Text)
    lecture_hours = Column(Integer, default=0)
    practice_hours = Column(Integer, default=0)
    lab_hours = Column(Integer, default=0)
    self_study_hours = Column(Integer, default=0)
    # Номер семестра, к которому относится раздел. Если у дисциплины БУПа один
    # семестр — поле игнорируется (UI его не показывает). Если несколько —
    # каждый раздел вводится в контексте своего семестра, и в печатной форме
    # таблица 6 (Содержание) разбивается на блоки `discipline_semesters`.
    semester = Column(SmallInteger, nullable=True)

    rpd = relationship("Rpd", back_populates="sections")


class RpdTopic(Base):
    """Тема практического занятия или лабораторной работы.

    Раньше темы привязывались к конкретному разделу дисциплины (`id_section`),
    но в АРМ РПД у разделов 4.1 / 4.2 нет такой группировки — это просто две
    плоских таблицы тем, заполняемых преподавателем. Теперь привязка прямая
    к РПД, без разделов; тип определяет, в какую таблицу попадёт тема."""
    __tablename__ = "rpd_topics"
    id_topic = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    topic_type = Column(String(30), nullable=False)
    title = Column(String(500), nullable=False)
    hours = Column(Integer)
    description = Column(Text)
    rpd = relationship("Rpd", back_populates="topics")


class RpdLearningOutcome(Base):
    """Строка раздела 2 «Планируемые результаты обучения».

    `id_indicator` — FK на текущий индикатор компетенции. После hard-delete БУПа
    индикатор может уехать вместе с осиротевшей компетенцией (если компетенция
    использовалась только этим планом). Поэтому держим snapshot:
    `indicator_code`, `indicator_description`, `competency_code`, `competency_name`.
    Заполняется при создании; при чтении приоритет у snapshot, fallback — на FK.
    """
    __tablename__ = "rpd_learning_outcomes"
    id_outcome = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    id_indicator = Column(
        Integer, ForeignKey("competency_indicators.id_indicator", ondelete="SET NULL"),
        nullable=True,
    )
    outcome_text = Column(Text)
    assessment_tool = Column(String(200))
    # Snapshot
    indicator_code = Column(String(20))
    indicator_description = Column(Text)
    competency_code = Column(String(20))
    competency_name = Column(Text)
    rpd = relationship("Rpd", back_populates="learning_outcomes")
    indicator = relationship("CompetencyIndicator")


class RpdLiterature(Base):
    __tablename__ = "rpd_literature"
    id_literature = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    # Вид литературы — одно из значений из constants на фронте: «Учебные и научные
    # издания», «Периодические издания», «Нормативно-технические издания»,
    # «Методические указания…», «Учебно-методическое обеспечение СРС».
    source_type = Column(String(120), nullable=False)
    title = Column(Text, nullable=False)
    # Печатная — экземпляры; электронная — URL + список ЭБС, в которых она доступна
    # (JSON-массив строк).
    copies_count = Column(Integer)
    url = Column(String(500))
    # ЭБС, в которых доступна электронная литература (multi-select на фронте).
    # JSONB-массив строк; для печатной — пусто/None.
    availability = Column(JSONB)
    # Старые поля — оставлены для обратной совместимости с уже введёнными РПД,
    # но в UI больше не показываются и в новых РПД не заполняются.
    authors = Column(String(500))
    year = Column(Integer)
    publisher = Column(String(200))
    rpd = relationship("Rpd", back_populates="literature")


class RpdSoftware(Base):
    __tablename__ = "rpd_software"
    id_software = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    name = Column(String(300), nullable=False)
    # Вид ПО — например «Лицензионное» / «Свободно распространяемое» / «Офисное» / …
    # Колонка `license_type` исторически тут уже была — переиспользуем её под
    # «Вид ПО», смысл совпадает. `purpose` оставлен как legacy-поле.
    license_type = Column(String(100))
    purpose = Column(String(200))
    rpd = relationship("Rpd", back_populates="software")


class RpdMaterialTech(Base):
    __tablename__ = "rpd_material_tech"
    id_material_tech = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    room_type = Column(String(100), nullable=False)
    equipment = Column(Text)
    quantity = Column(Integer)
    rpd = relationship("Rpd", back_populates="material_tech")


class RpdDatabase(Base):
    __tablename__ = "rpd_databases"
    id_database = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    # Вид БД — например «Реферативная», «Полнотекстовая», «Информационно-справочная».
    db_type = Column(String(120))
    name = Column(Text, nullable=False)
    # url оставлен legacy-полем: в новых РПД не используется (по требованию убрать
    # ввод URL из формы 6.4). Старые данные сохраняем.
    url = Column(String(500))
    rpd = relationship("Rpd", back_populates="databases")


class RpdFosFile(Base):
    """Файл ФОС, прикреплённый к РПД.

    `role`:
      - 'main'  — основной файл ФОС (один на РПД, попадает в DOCX);
      - 'other' — прочие файлы ФОС (несколько, в DOCX не попадают).
    """
    __tablename__ = "rpd_fos_files"
    id_rpd_fos = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    id_file = Column(Integer, ForeignKey("stored_files.id_file"), nullable=False)
    role = Column(String(10), nullable=False, default="other")
    name = Column(String(300))
    comment = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    rpd = relationship("Rpd", back_populates="fos_files")
    file = relationship("StoredFile", foreign_keys=[id_file])


class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"
    id_document = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    id_user = Column(Integer, ForeignKey("users.id_user"), nullable=False)
    filename = Column(String(300), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(10), nullable=False)
    file_size = Column(Integer)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    rpd = relationship("Rpd", back_populates="uploaded_documents")
    uploader = relationship("User")


class LlmGenerationLog(Base):
    __tablename__ = "llm_generation_log"
    id_log = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    section_name = Column(String(100), nullable=False)
    prompt_hash = Column(String(64))
    model_name = Column(String(100))
    tokens_used = Column(Integer)
    generation_time_ms = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    rpd = relationship("Rpd", back_populates="llm_logs")


class ApprovalStage(Base):
    __tablename__ = "approval_stages"
    id_approval = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    id_reviewer = Column(Integer, ForeignKey("users.id_user"), nullable=False)
    stage = Column(String(30), nullable=False)
    status = Column(String(30), nullable=False)
    comment = Column(Text)
    reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    rpd = relationship("Rpd", back_populates="approvals")
    reviewer = relationship("User")
