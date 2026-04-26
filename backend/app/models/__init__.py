"""Aggregate re-exports of all SQLAlchemy ORM models.

Canonical homes:
- user.py        — Role, Department, User, Notification
- curriculum.py  — Direction, Discipline, Competency, CompetencyIndicator, DisciplineCompetency
- rpd.py         — Rpd + RpdSection, RpdTopic, RpdLiterature, RpdSoftware,
                   RpdMaterialTech, RpdDatabase, RpdLearningOutcome, RpdDeveloper,
                   UploadedDocument, LlmGenerationLog, ApprovalStage

`from app.models import X` is the preferred import path. The legacy
`from app.models.user import X` still works for any model — `user.py`
re-exports the curriculum and rpd models for backwards compatibility.
"""
from app.models.user import Role, Department, User, Notification
from app.models.curriculum import (
    Direction, Discipline, Competency, CompetencyIndicator, DisciplineCompetency,
)
from app.models.rpd import (
    Rpd, RpdDeveloper, RpdSection, RpdTopic, RpdLearningOutcome,
    RpdLiterature, RpdSoftware, RpdMaterialTech, RpdDatabase,
    UploadedDocument, LlmGenerationLog, ApprovalStage,
)

__all__ = [
    "Role", "Department", "User", "Notification",
    "Direction", "Discipline", "Competency", "CompetencyIndicator", "DisciplineCompetency",
    "Rpd", "RpdDeveloper", "RpdSection", "RpdTopic", "RpdLearningOutcome",
    "RpdLiterature", "RpdSoftware", "RpdMaterialTech", "RpdDatabase",
    "UploadedDocument", "LlmGenerationLog", "ApprovalStage",
]
