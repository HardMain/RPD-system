from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import (
    get_current_user, hash_password, user_can,
    can_create_user_with, assignable_role_names, assignable_department_ids,
)
from app.models.user import User, Role, Department
from app.schemas import UserCreate, UserDetailOut, RoleOut, DepartmentOut

router = APIRouter(prefix="/api/admin", tags=["admin"])

def _require_admin(user: User):
    if not user_can(user, "users.manage"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

def _require_user_admin_or_creator(user: User):
    if not (user_can(user, "users.manage") or user_can(user, "users.create")):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

async def _resolve_target_role_name(db: AsyncSession, id_role: int) -> str:
    role = await db.get(Role, id_role)
    if not role:
        raise HTTPException(status_code=400, detail="Указанная роль не найдена")
    return role.name

@router.get("/users", response_model=list[UserDetailOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_user_admin_or_creator(user)
    result = await db.execute(
        select(User).options(selectinload(User.role), selectinload(User.department))
        .order_by(User.full_name)
    )
    rows = result.scalars().all()
    return [
        UserDetailOut(
            id_user=u.id_user, ldap_uid=u.ldap_uid, full_name=u.full_name,
            title=u.title, employee_type=u.employee_type,
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
    _require_user_admin_or_creator(user)
    target_role_name = await _resolve_target_role_name(db, data.id_role)
    if not can_create_user_with(user, target_role_name, data.id_department):
        raise HTTPException(
            status_code=403,
            detail=f"У вас нет прав создавать пользователя с ролью «{target_role_name}» в этом подразделении",
        )
    existing = await db.execute(select(User).where(User.ldap_uid == data.ldap_uid))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

    new_user = User(
        ldap_uid=data.ldap_uid,
        full_name=data.full_name,
        title=data.title,
        employee_type=data.employee_type,
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
        title=u.title, employee_type=u.employee_type,
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
    _require_user_admin_or_creator(user)
    result = await db.execute(
        select(User).where(User.id_user == user_id)
        .options(selectinload(User.role), selectinload(User.department))
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404)

    current_role = target.role.name if target.role else ""
    if not can_create_user_with(user, current_role, target.id_department):
        raise HTTPException(status_code=403, detail="Этот пользователь вне вашего scope")

    allowed = {"full_name", "title", "employee_type", "email", "id_role", "id_department", "is_active", "ldap_uid"}
    for k, v in data.items():
        if k in allowed:
            setattr(target, k, v)
        elif k == "password" and v:
            target.password_hash = hash_password(v)

    new_role_name = current_role
    new_dept_id = target.id_department
    if "id_role" in data and data["id_role"] != target.id_role:
        new_role_name = await _resolve_target_role_name(db, data["id_role"])
    if "id_department" in data:
        new_dept_id = data["id_department"]
    if not can_create_user_with(user, new_role_name, new_dept_id):
        raise HTTPException(
            status_code=403,
            detail=f"У вас нет прав назначать роль «{new_role_name}» в этом подразделении",
        )

    await db.commit()
    await db.refresh(target)
    result = await db.execute(
        select(User).where(User.id_user == user_id)
        .options(selectinload(User.role), selectinload(User.department))
    )
    u = result.scalar_one()
    return UserDetailOut(
        id_user=u.id_user, ldap_uid=u.ldap_uid, full_name=u.full_name,
        title=u.title, employee_type=u.employee_type,
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
    _require_user_admin_or_creator(user)
    result = await db.execute(
        select(User).where(User.id_user == user_id)
        .options(selectinload(User.role))
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404)
    if not can_create_user_with(user, target.role.name if target.role else "", target.id_department):
        raise HTTPException(status_code=403, detail="Этот пользователь вне вашего scope")
    target.is_active = False
    await db.commit()

@router.get("/roles", response_model=list[RoleOut])
async def list_roles(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    _require_user_admin_or_creator(user)
    result = await db.execute(select(Role).order_by(Role.id_role))
    rows = list(result.scalars().all())
    allowed = assignable_role_names(user)
    if allowed is None:
        return rows
    return [r for r in rows if r.name in allowed]

@router.get("/departments", response_model=list[DepartmentOut])
async def list_departments(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    _require_user_admin_or_creator(user)
    result = await db.execute(select(Department).order_by(Department.name))
    rows = list(result.scalars().all())
    allowed = assignable_department_ids(user)
    if allowed is None:
        return rows
    return [d for d in rows if d.id_department in allowed]

@router.get("/users/search", response_model=list[UserDetailOut])
async def search_users(
    q: str = "",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(User).options(selectinload(User.role), selectinload(User.department))
    if q:
        query = query.where(User.full_name.ilike(f"%{q}%"))
    query = query.where(User.is_active == True).order_by(User.full_name).limit(20)
    result = await db.execute(query)
    rows = result.scalars().all()
    return [
        UserDetailOut(
            id_user=u.id_user, ldap_uid=u.ldap_uid, full_name=u.full_name,
            title=u.title, employee_type=u.employee_type,
            email=u.email, is_active=u.is_active,
            role=u.role.name if u.role else "",
            department=u.department.name if u.department else "",
            id_role=u.id_role, id_department=u.id_department,
            created_at=u.created_at,
        )
        for u in rows
    ]
