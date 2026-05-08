from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime

class UserCreate(BaseModel):
    ldap_uid: str
    full_name: str
    title: str | None = None
    employee_type: str | None = None
    email: str | None = None
    id_role: int
    id_department: int
    password: str | None = None

class UserDetailOut(BaseModel):
    id_user: int
    ldap_uid: str
    full_name: str
    title: str | None = None
    employee_type: str | None = None
    email: str | None = None
    is_active: bool
    role: str
    department: str
    id_role: int
    id_department: int
    created_at: datetime | None = None

    class Config:
        from_attributes = True

class RoleOut(BaseModel):
    id_role: int
    name: str

    class Config:
        from_attributes = True

class DepartmentOut(BaseModel):
    id_department: int
    name: str
    faculty: str | None = None

    class Config:
        from_attributes = True
