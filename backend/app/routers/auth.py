from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import verify_password, create_access_token, get_current_user, user_permission_codes
from app.models.user import User, Role, RolePermission
from app.schemas import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .where(User.login == form.username)
        .options(
            selectinload(User.role).selectinload(Role.permissions).selectinload(RolePermission.permission),
            selectinload(User.department),
        )
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверные учётные данные")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Учётная запись деактивирована")

    token = create_access_token({"sub": str(user.id_user)})
    return TokenResponse(
        access_token=token,
        user=UserOut(
            id_user=user.id_user,
            full_name=user.full_name,
            title=user.title,
            email=user.email,
            role=user.role.name if user.role else "",
            department=user.department.name if user.department else "",
            permissions=sorted(user_permission_codes(user)),
        ),
    )

@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return UserOut(
        id_user=user.id_user,
        full_name=user.full_name,
        title=user.title,
        email=user.email,
        role=user.role.name if user.role else "",
        department=user.department.name if user.department else "",
        permissions=sorted(user_permission_codes(user)),
    )
