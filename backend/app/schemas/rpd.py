from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime

class RpdManualPayload(BaseModel):
    id_discipline: int | None = None
    discipline_name: str | None = None
    direction_code: str | None = None
    direction_name: str | None = None
    direction_profile: str | None = None
    semester: str | None = None
    control_form: str | None = None
    total_hours: int | None = None
    exam_hours: int | None = None
    lecture_hours: int | None = None
    lab_hours: int | None = None
    practice_hours: int | None = None
    ksr_hours: int | None = None
    self_study_hours: int | None = None
    zet: int | None = None
    semesters_data: list[dict] | None = None
    form_of_study: str | None = None

class ManualLinkUpdate(BaseModel):
    direction_code: str | None = None
    direction_name: str | None = None
    direction_profile: str | None = None
    semester: str | None = None
    control_form: str | None = None
    total_hours: int | None = None
    exam_hours: int | None = None
    zet: int | None = None
    semesters_data: list[dict] | None = None
    form_of_study: str | None = None

class ManualOutcomeCreate(BaseModel):
    competency_code: str | None = None
    competency_name: str | None = None
    indicator_code: str | None = None
    indicator_description: str | None = None
    outcome_text: str | None = None
    assessment_tool: str | None = None
    id_indicator: int | None = None

class RpdCreate(BaseModel):
    id_discipline: int | None = None
    bup_discipline_ids: list[int] = []
    academic_year: str
    based_on_rpd_id: int | None = None
    manual: RpdManualPayload | None = None

class OutcomeUpsert(BaseModel):
    id_outcome: int | None = None
    id_indicator: int | None = None
    outcome_text: str = ""
    assessment_tool: str = ""

class FosFileOut(BaseModel):
    id_rpd_fos: int
    id_file: int
    role: str
    name: str | None = None
    comment: str | None = None
    original_name: str
    size_bytes: int | None = None

    class Config:
        from_attributes = True

class FosFileSelect(BaseModel):
    id_file: int
    role: str = "other"
    name: str | None = None
    comment: str | None = None

class OutcomeRowOut(BaseModel):
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

class RpdTopicOut(BaseModel):
    id_topic: int
    id_rpd: int
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
    availability: list[str] | None = None
    authors: str | None = None
    year: int | None = None
    publisher: str | None = None

    class Config:
        from_attributes = True

class SoftwareCreate(BaseModel):
    name: str
    license_type: str | None = None

class SoftwareOut(BaseModel):
    id_software: int
    name: str
    license_type: str | None = None
    purpose: str | None = None

    class Config:
        from_attributes = True

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

class DatabaseCreate(BaseModel):
    name: str
    db_type: str | None = None

class DatabaseOut(BaseModel):
    id_database: int
    name: str
    db_type: str | None = None
    url: str | None = None

    class Config:
        from_attributes = True

class LearningOutcomeCreate(BaseModel):
    id_indicator: int
    outcome_text: str | None = None
    assessment_tool: str | None = None

class LearningOutcomeOut(BaseModel):
    id_outcome: int
    id_indicator: int | None = None
    indicator_code: str | None = None
    competency_code: str | None = None
    outcome_text: str | None = None
    assessment_tool: str | None = None

    class Config:
        from_attributes = True

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

class ApprovalAction(BaseModel):
    action: str
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

class LlmGenerateRequest(BaseModel):
    section: str
    context: str | None = None

class LlmGenerateResponse(BaseModel):
    section: str
    generated_text: str
    model: str
    tokens_used: int | None = None

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
    comment: str | None = None
    developer_names: list[str] = []

    class Config:
        from_attributes = True

class BupDisciplineRefOut(BaseModel):
    id_bup_discipline: int | None = None
    id_bup: int | None = None
    bup_name: str
    code: str | None = None
    semester: str | None = None
    control_form: str | None = None
    total_hours: int | None = None
    exam_hours: int | None = None
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
    semesters_data: list[dict] | None = None
    form_of_study: str | None = None
    bup_deleted: bool = False
    is_manual: bool = False

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
    topics: list[RpdTopicOut] = []
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
