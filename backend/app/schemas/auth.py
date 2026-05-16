from __future__ import annotations
from pydantic import BaseModel

class LoginRequest(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id_user: int
    full_name: str
    title: str | None = None
    email: str | None = None
    role: str
    department: str
    avatar_color: str | None = None
    avatar_data_url: str | None = None
    theme: str | None = None
    permissions: list[str] = []

class ProfileUpdate(BaseModel):
    email: str | None = None
    avatar_color: str | None = None
    theme: str | None = None

    class Config:
        from_attributes = True

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
