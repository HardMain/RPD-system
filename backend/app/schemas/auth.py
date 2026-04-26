"""Auth-related schemas: login request, token, current-user payload."""
from __future__ import annotations
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id_user: int
    full_name: str
    email: str | None = None
    role: str
    department: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
