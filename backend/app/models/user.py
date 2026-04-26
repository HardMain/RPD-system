"""User-domain models: roles, departments, users, notifications.

Note: this module historically held ALL models. After the split it owns only
user-related ones, and re-exports the rest for backwards compatibility — see
`app/models/__init__.py` for canonical homes.
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Role(Base):
    __tablename__ = "roles"
    id_role = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)
    users = relationship("User", back_populates="role")


class Department(Base):
    __tablename__ = "departments"
    id_department = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    faculty = Column(String(150))
    users = relationship("User", back_populates="department")


class User(Base):
    __tablename__ = "users"
    id_user = Column(Integer, primary_key=True, autoincrement=True)
    id_role = Column(Integer, ForeignKey("roles.id_role"), nullable=False)
    id_department = Column(Integer, ForeignKey("departments.id_department"), nullable=False)
    ldap_uid = Column(String(100), nullable=False, unique=True)
    full_name = Column(String(200), nullable=False)
    email = Column(String(150))
    password_hash = Column(String(200))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    role = relationship("Role", back_populates="users")
    department = relationship("Department", back_populates="users")


class Notification(Base):
    __tablename__ = "notifications"
    id_notification = Column(Integer, primary_key=True, autoincrement=True)
    id_user = Column(Integer, ForeignKey("users.id_user"), nullable=False)
    id_rpd = Column(Integer, nullable=True)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User")


# ── Backwards-compat re-exports ───────────────────────────────────────────────
# Older imports do `from app.models.user import Direction, Rpd, ...`. Keep them
# working by surfacing the curriculum & rpd models from this module too. New
# code should prefer `from app.models import X`.
from app.models.curriculum import (  # noqa: E402,F401
    Direction, Discipline, Competency, CompetencyIndicator, DisciplineCompetency,
)
from app.models.rpd import (  # noqa: E402,F401
    Rpd, RpdDeveloper, RpdSection, RpdTopic, RpdLearningOutcome,
    RpdLiterature, RpdSoftware, RpdMaterialTech, RpdDatabase,
    UploadedDocument, LlmGenerationLog, ApprovalStage,
)
