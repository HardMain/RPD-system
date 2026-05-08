from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, Role, RolePermission, Permission

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Невалидный токен",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(User).where(User.id_user == user_id)
        .options(
            selectinload(User.role).selectinload(Role.permissions).selectinload(RolePermission.permission),
            selectinload(User.department),
        )
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Учётная запись деактивирована")
    return user

def user_permission_codes(user: User) -> set[str]:
    if not user.role or not user.role.permissions:
        return set()
    return {rp.permission.code for rp in user.role.permissions if rp.permission}

def user_can(user: User, perm: str) -> bool:
    codes = user_permission_codes(user)
    return "*" in codes or perm in codes

def require_permission(perm: str):
    def _dep(user: User = Depends(get_current_user)) -> User:
        if not user_can(user, perm):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return user
    return _dep

TECH_UMU_ASSIGNABLE_ROLES = {
    "Преподаватель", "Зав. кафедрой", "Сотрудник УМУ",
    "Начальник отдела УМУ", "Техник кафедры",
}

def can_create_user_with(creator: User, target_role_name: str, target_department_id: int) -> bool:
    if user_can(creator, "*"):
        return True
    if not creator.role:
        return False
    creator_role = creator.role.name
    if creator_role == "Техник УМУ":
        return target_role_name in TECH_UMU_ASSIGNABLE_ROLES
    if creator_role == "Техник кафедры":
        return (
            target_role_name == "Преподаватель"
            and target_department_id == creator.id_department
        )
    return False

def assignable_role_names(creator: User) -> set[str] | None:
    if user_can(creator, "*"):
        return None
    if not creator.role:
        return set()
    if creator.role.name == "Техник УМУ":
        return set(TECH_UMU_ASSIGNABLE_ROLES)
    if creator.role.name == "Техник кафедры":
        return {"Преподаватель"}
    return set()

def assignable_department_ids(creator: User) -> set[int] | None:
    if user_can(creator, "*"):
        return None
    if not creator.role:
        return set()
    if creator.role.name == "Техник УМУ":
        return None
    if creator.role.name == "Техник кафедры":
        return {creator.id_department}
    return set()
