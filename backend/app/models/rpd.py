from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, SmallInteger, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, backref
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
    comment = Column(Text)
    based_on_rpd_id = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    discipline = relationship("Discipline", back_populates="rpds")
    author = relationship("User", foreign_keys=[id_author])
    bup_links = relationship("RpdBupDiscipline", back_populates="rpd", cascade="all, delete-orphan")
    developers = relationship("RpdDeveloper", back_populates="rpd", cascade="all, delete-orphan")
    sections = relationship("RpdSection", back_populates="rpd", cascade="all, delete-orphan",
                            order_by="RpdSection.section_number")
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
    approval_route = relationship("RpdApprovalRoute", back_populates="rpd", cascade="all, delete-orphan",
                                  order_by="RpdApprovalRoute.step_order")

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
    semester = Column(SmallInteger, nullable=True)

    rpd = relationship("Rpd", back_populates="sections")

class RpdTopic(Base):
    __tablename__ = "rpd_topics"
    id_topic = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    topic_type = Column(String(30), nullable=False)
    title = Column(String(500), nullable=False)
    hours = Column(Integer)
    description = Column(Text)
    rpd = relationship("Rpd", back_populates="topics")

class RpdLearningOutcome(Base):
    __tablename__ = "rpd_learning_outcomes"
    id_outcome = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    id_rpd_bup_discipline = Column(
        Integer, ForeignKey("rpd_bup_disciplines.id_rpd_bup_discipline", ondelete="CASCADE"),
        nullable=True,
    )
    id_indicator = Column(
        Integer, ForeignKey("competency_indicators.id_indicator", ondelete="SET NULL"),
        nullable=True,
    )
    outcome_text = Column(Text)
    assessment_tool = Column(String(200))
    indicator_code = Column(String(20))
    indicator_description = Column(Text)
    competency_code = Column(String(20))
    competency_name = Column(Text)
    rpd = relationship("Rpd", back_populates="learning_outcomes")
    indicator = relationship("CompetencyIndicator")
    bup_link = relationship("RpdBupDiscipline")

class RpdLiterature(Base):
    __tablename__ = "rpd_literature"
    id_literature = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    source_type = Column(String(120), nullable=False)
    title = Column(Text, nullable=False)
    copies_count = Column(Integer)
    url = Column(String(500))
    availability = Column(JSONB)
    authors = Column(String(500))
    year = Column(Integer)
    publisher = Column(String(200))
    rpd = relationship("Rpd", back_populates="literature")

class RpdSoftware(Base):
    __tablename__ = "rpd_software"
    id_software = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    name = Column(String(300), nullable=False)
    license_type = Column(String(100))
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
    db_type = Column(String(120))
    name = Column(Text, nullable=False)
    url = Column(String(500))
    rpd = relationship("Rpd", back_populates="databases")

class RpdFosFile(Base):
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
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=True)
    id_user = Column(Integer, ForeignKey("users.id_user"), nullable=False)
    filename = Column(String(300), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(10), nullable=False)
    file_size = Column(Integer)
    text_chars = Column(Integer)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    rpd = relationship("Rpd", back_populates="uploaded_documents")
    uploader = relationship("User")

class UploadedDocumentSection(Base):
    __tablename__ = "uploaded_document_sections"
    id_section_chunk = Column(Integer, primary_key=True, autoincrement=True)
    id_document = Column(Integer, ForeignKey("uploaded_documents.id_document", ondelete="CASCADE"), nullable=False)
    section_key = Column(String(80), nullable=False, index=True)
    content = Column(Text, nullable=False)
    extraction_method = Column(String(20), nullable=False, default="heuristic")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    document = relationship(
        "UploadedDocument",
        backref=backref("section_chunks", cascade="all, delete-orphan", passive_deletes=True),
    )


class LlmGenerationLog(Base):
    __tablename__ = "llm_generation_log"
    id_log = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    section_name = Column(String(100), nullable=False)
    prompt_hash = Column(String(64))
    model_name = Column(String(100))
    tokens_used = Column(Integer)
    generation_time_ms = Column(Integer)
    context_sources = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    rpd = relationship("Rpd", back_populates="llm_logs")


class LlmPrompt(Base):
    __tablename__ = "llm_prompts"
    id_prompt = Column(Integer, primary_key=True, autoincrement=True)
    section_key = Column(String(80), unique=True, nullable=False)
    section_label = Column(String(200), nullable=False)
    is_structural = Column(Boolean, default=False, nullable=False)
    system_prompt = Column(Text)
    default_system_prompt = Column(Text)
    user_prompt_template = Column(Text, nullable=False)
    default_user_prompt_template = Column(Text, nullable=False, server_default="")
    description = Column(Text)
    order_index = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

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

class RpdApprovalRoute(Base):
    __tablename__ = "rpd_approval_routes"
    id_route = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd", ondelete="CASCADE"), nullable=False)
    step_order = Column(SmallInteger, nullable=False)
    id_reviewer = Column(Integer, ForeignKey("users.id_user"), nullable=False)
    status = Column(String(20), nullable=False, default="waiting")
    comment = Column(Text)
    reviewed_at = Column(DateTime(timezone=True))
    rpd = relationship("Rpd", back_populates="approval_route")
    reviewer = relationship("User")
