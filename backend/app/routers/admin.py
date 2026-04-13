"""Admin endpoints for user management and system config."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user, hash_password
from app.models.user import User, Role, Department
from app.schemas import UserCreate, UserDetailOut, RoleOut, DepartmentOut

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _require_admin(user: User):
    if not user.role or user.role.name != "Администратор":
        raise HTTPException(status_code=403, detail="Доступ только для администратора")


@router.get("/users", response_model=list[UserDetailOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    result = await db.execute(
        select(User).options(selectinload(User.role), selectinload(User.department))
        .order_by(User.full_name)
    )
    rows = result.scalars().all()
    return [
        UserDetailOut(
            id_user=u.id_user, ldap_uid=u.ldap_uid, full_name=u.full_name,
            email=u.email, is_active=u.is_active,
            role=u.role.name if u.role else "",
            department=u.department.name if u.department else "",
            id_role=u.id_role, id_department=u.id_department,
            created_at=u.created_at,
        )
        for u in rows
    ]


@router.post("/users", response_model=UserDetailOut, status_code=201)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    # Check uniqueness
    existing = await db.execute(select(User).where(User.ldap_uid == data.ldap_uid))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

    new_user = User(
        ldap_uid=data.ldap_uid,
        full_name=data.full_name,
        email=data.email,
        id_role=data.id_role,
        id_department=data.id_department,
        password_hash=hash_password(data.password or "password"),
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    result = await db.execute(
        select(User).where(User.id_user == new_user.id_user)
        .options(selectinload(User.role), selectinload(User.department))
    )
    u = result.scalar_one()
    return UserDetailOut(
        id_user=u.id_user, ldap_uid=u.ldap_uid, full_name=u.full_name,
        email=u.email, is_active=u.is_active,
        role=u.role.name if u.role else "",
        department=u.department.name if u.department else "",
        id_role=u.id_role, id_department=u.id_department,
        created_at=u.created_at,
    )


@router.patch("/users/{user_id}", response_model=UserDetailOut)
async def update_user(
    user_id: int, data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    result = await db.execute(
        select(User).where(User.id_user == user_id)
        .options(selectinload(User.role), selectinload(User.department))
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404)

    allowed = {"full_name", "email", "id_role", "id_department", "is_active", "ldap_uid"}
    for k, v in data.items():
        if k in allowed:
            setattr(target, k, v)
        elif k == "password" and v:
            target.password_hash = hash_password(v)

    await db.commit()
    await db.refresh(target)
    result = await db.execute(
        select(User).where(User.id_user == user_id)
        .options(selectinload(User.role), selectinload(User.department))
    )
    u = result.scalar_one()
    return UserDetailOut(
        id_user=u.id_user, ldap_uid=u.ldap_uid, full_name=u.full_name,
        email=u.email, is_active=u.is_active,
        role=u.role.name if u.role else "",
        department=u.department.name if u.department else "",
        id_role=u.id_role, id_department=u.id_department,
        created_at=u.created_at,
    )


@router.delete("/users/{user_id}", status_code=204)
async def deactivate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_admin(user)
    result = await db.execute(select(User).where(User.id_user == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404)
    target.is_active = False
    await db.commit()


@router.get("/roles", response_model=list[RoleOut])
async def list_roles(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    _require_admin(user)
    result = await db.execute(select(Role).order_by(Role.id_role))
    return result.scalars().all()


@router.get("/departments", response_model=list[DepartmentOut])
async def list_departments(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    _require_admin(user)
    result = await db.execute(select(Department).order_by(Department.name))
    return result.scalars().all()


# ── Search users (for developer picker) ──

@router.get("/users/search", response_model=list[UserDetailOut])
async def search_users(
    q: str = "",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Search users by name (available to all authenticated users for developer assignment)."""
    query = select(User).options(selectinload(User.role), selectinload(User.department))
    if q:
        query = query.where(User.full_name.ilike(f"%{q}%"))
    query = query.where(User.is_active == True).order_by(User.full_name).limit(20)
    result = await db.execute(query)
    rows = result.scalars().all()
    return [
        UserDetailOut(
            id_user=u.id_user, ldap_uid=u.ldap_uid, full_name=u.full_name,
            email=u.email, is_active=u.is_active,
            role=u.role.name if u.role else "",
            department=u.department.name if u.department else "",
            id_role=u.id_role, id_department=u.id_department,
            created_at=u.created_at,
        )
        for u in rows
    ]
