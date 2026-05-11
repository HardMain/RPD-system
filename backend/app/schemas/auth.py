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
    permissions: list[str] = []

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
