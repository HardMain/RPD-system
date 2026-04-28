"""Aggregate re-exports of all Pydantic schemas.

Canonical homes:
- auth.py          — LoginRequest, TokenResponse, UserOut
- curriculum.py    — DirectionOut, DisciplineOut, IndicatorOut, CompetencyOut, DisciplineCompetencyOut
- bup.py           — BupOut, BupDetailOut, BupDisciplineOut, BupDisciplineCompetencyOut
- storage.py       — StoredFileOut
- rpd.py           — RpdCreate/Update, RpdSection*, RpdTopic*, Literature*, Software*,
                     MaterialTech*, Database*, LearningOutcome*, Developer*, UploadedDocumentOut,
                     ApprovalAction/Out, LlmGenerate*, RpdListOut, RpdDetailOut
- notification.py  — NotificationOut
- admin.py         — UserCreate, UserDetailOut, RoleOut, DepartmentOut

`from app.schemas import X` continues to work for every schema.
"""
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.schemas.curriculum import (
    DirectionOut, DisciplineOut, IndicatorOut, CompetencyOut, DisciplineCompetencyOut,
)
from app.schemas.bup import (
    BupOut, BupDetailOut, BupDisciplineOut, BupDisciplineCompetencyOut,
    BupCreate, BupUpdate, BupDisciplineCreate, BupDisciplineUpdate,
    BupImportResult,
)
from app.schemas.storage import StoredFileOut
from app.schemas.rpd import (
    RpdCreate, RpdUpdate,
    RpdTopicOut, RpdTopicCreate, RpdTopicUpdate,
    RpdSectionOut, RpdSectionCreate,
    LiteratureCreate, LiteratureUpdate, LiteratureOut,
    SoftwareCreate, SoftwareOut,
    MaterialTechCreate, MaterialTechOut,
    DatabaseCreate, DatabaseOut,
    LearningOutcomeCreate, LearningOutcomeOut,
    DeveloperOut, UploadedDocumentOut,
    ApprovalAction, ApprovalOut,
    LlmGenerateRequest, LlmGenerateResponse,
    RpdListOut, RpdDetailOut,
    OutcomeUpsert, OutcomeRowOut,
    BupDisciplineRefOut,
)
from app.schemas.notification import NotificationOut
from app.schemas.admin import UserCreate, UserDetailOut, RoleOut, DepartmentOut

# Resolve forward refs for schemas that reference each other across files
TokenResponse.model_rebuild()
RpdDetailOut.model_rebuild()

__all__ = [
    # auth
    "LoginRequest", "TokenResponse", "UserOut",
    # curriculum
    "DirectionOut", "DisciplineOut", "IndicatorOut", "CompetencyOut", "DisciplineCompetencyOut",
    # bup
    "BupOut", "BupDetailOut", "BupDisciplineOut", "BupDisciplineCompetencyOut",
    "BupCreate", "BupUpdate", "BupDisciplineCreate", "BupDisciplineUpdate",
    "BupImportResult",
    # storage
    "StoredFileOut",
    # rpd
    "RpdCreate", "RpdUpdate",
    "RpdTopicOut", "RpdTopicCreate", "RpdTopicUpdate",
    "RpdSectionOut", "RpdSectionCreate",
    "LiteratureCreate", "LiteratureUpdate", "LiteratureOut",
    "SoftwareCreate", "SoftwareOut",
    "MaterialTechCreate", "MaterialTechOut",
    "DatabaseCreate", "DatabaseOut",
    "LearningOutcomeCreate", "LearningOutcomeOut",
    "DeveloperOut", "UploadedDocumentOut",
    "ApprovalAction", "ApprovalOut",
    "LlmGenerateRequest", "LlmGenerateResponse",
    "RpdListOut", "RpdDetailOut",
    "OutcomeUpsert", "OutcomeRowOut",
    "BupDisciplineRefOut",
    # notification
    "NotificationOut",
    # admin
    "UserCreate", "UserDetailOut", "RoleOut", "DepartmentOut",
]
