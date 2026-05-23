from app.schemas.auth import ChangePasswordRequest, LoginRequest, ProfileUpdate, TokenResponse, UserOut
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
    RpdCreate, RpdUpdate, RpdManualPayload, ManualLinkUpdate, HeaderMetaUpdate, ManualOutcomeCreate,
    RpdTopicOut, RpdTopicCreate, RpdTopicUpdate,
    RpdSectionOut, RpdSectionCreate,
    LiteratureCreate, LiteratureUpdate, LiteratureOut,
    SoftwareCreate, SoftwareOut,
    MaterialTechCreate, MaterialTechOut,
    DatabaseCreate, DatabaseOut,
    LearningOutcomeCreate, LearningOutcomeOut,
    DeveloperOut, UploadedDocumentOut,
    ApprovalAction, ApprovalOut, ApprovalRouteStepOut, ApprovalRouteUpdate, ReviewerCandidateOut,
    LlmGenerateRequest, LlmGenerateResponse,
    RpdListOut, RpdDetailOut,
    OutcomeUpsert, OutcomeRowOut,
    BupDisciplineRefOut,
    FosFileOut, FosFileSelect,
)
from app.schemas.notification import NotificationOut
from app.schemas.admin import UserCreate, UserDetailOut, RoleOut, DepartmentIn, DepartmentOut

TokenResponse.model_rebuild()
RpdDetailOut.model_rebuild()

__all__ = [
    "ChangePasswordRequest", "LoginRequest", "ProfileUpdate", "TokenResponse", "UserOut",
    "DirectionOut", "DisciplineOut", "IndicatorOut", "CompetencyOut", "DisciplineCompetencyOut",
    "BupOut", "BupDetailOut", "BupDisciplineOut", "BupDisciplineCompetencyOut",
    "BupCreate", "BupUpdate", "BupDisciplineCreate", "BupDisciplineUpdate",
    "BupImportResult",
    "StoredFileOut",
    "RpdCreate", "RpdUpdate", "RpdManualPayload", "ManualLinkUpdate", "HeaderMetaUpdate", "ManualOutcomeCreate",
    "RpdTopicOut", "RpdTopicCreate", "RpdTopicUpdate",
    "RpdSectionOut", "RpdSectionCreate",
    "LiteratureCreate", "LiteratureUpdate", "LiteratureOut",
    "SoftwareCreate", "SoftwareOut",
    "MaterialTechCreate", "MaterialTechOut",
    "DatabaseCreate", "DatabaseOut",
    "LearningOutcomeCreate", "LearningOutcomeOut",
    "DeveloperOut", "UploadedDocumentOut",
    "ApprovalAction", "ApprovalOut", "ApprovalRouteStepOut", "ApprovalRouteUpdate", "ReviewerCandidateOut",
    "LlmGenerateRequest", "LlmGenerateResponse",
    "RpdListOut", "RpdDetailOut",
    "OutcomeUpsert", "OutcomeRowOut",
    "BupDisciplineRefOut",
    "FosFileOut", "FosFileSelect",
    "NotificationOut",
    "UserCreate", "UserDetailOut", "RoleOut", "DepartmentIn", "DepartmentOut",
]
