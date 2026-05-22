from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import (
    get_current_user, hash_password, user_can,
    can_create_user_with, assignable_role_names, assignable_department_ids,
)
from app.core.crud import get_or_404, ensure_permission
from app.models.user import User, Role, Department
from app.models.bup import BupDiscipline
from app.schemas import UserCreate, UserDetailOut, RoleOut, DepartmentIn, DepartmentOut, ReviewerCandidateOut

router = APIRouter(prefix="/api/admin", tags=["admin"])

def _require_admin(user: User):
    ensure_permission(user, "users.manage")

def _require_user_admin_or_creator(user: User):
    ensure_permission(user, "users.manage", "users.create")

def _require_dept_admin(user: User):
    ensure_permission(user, "users.manage", "sources.manage")

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
            id_user=u.id_user, login=u.login, full_name=u.full_name,
            title=u.title,
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
    existing = await db.execute(select(User).where(User.login == data.login))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

    new_user = User(
        login=data.login,
        full_name=data.full_name,
        title=data.title,
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
        id_user=u.id_user, login=u.login, full_name=u.full_name,
        title=u.title,
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

    allowed = {"full_name", "title", "email", "id_role", "id_department", "is_active", "login"}
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
        id_user=u.id_user, login=u.login, full_name=u.full_name,
        title=u.title,
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
    users_res = await db.execute(
        select(User.id_department, func.count(User.id_user)).group_by(User.id_department)
    )
    users_counts = {row[0]: row[1] for row in users_res.all()}
    bup_res = await db.execute(
        select(BupDiscipline.id_department, func.count(BupDiscipline.id_bup_discipline))
        .where(BupDiscipline.id_department.isnot(None))
        .group_by(BupDiscipline.id_department)
    )
    bup_counts = {row[0]: row[1] for row in bup_res.all()}
    result = await db.execute(select(Department).order_by(Department.name))
    rows = list(result.scalars().all())
    allowed = assignable_department_ids(user)
    if allowed is not None:
        rows = [d for d in rows if d.id_department in allowed]
    return [
        DepartmentOut(
            id_department=d.id_department,
            name=d.name,
            faculty=d.faculty,
            users_count=users_counts.get(d.id_department, 0),
            bup_disciplines_count=bup_counts.get(d.id_department, 0),
        )
        for d in rows
    ]

@router.post("/departments", response_model=DepartmentOut, status_code=201)
async def create_department(
    data: DepartmentIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_dept_admin(user)
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Название обязательно")
    dept = Department(name=name, faculty=(data.faculty or "").strip() or None)
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return DepartmentOut(
        id_department=dept.id_department, name=dept.name, faculty=dept.faculty,
        users_count=0, bup_disciplines_count=0,
    )

@router.patch("/departments/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: int,
    data: DepartmentIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_dept_admin(user)
    dept = await get_or_404(db, Department, dept_id, "Подразделение не найдено")
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Название обязательно")
    dept.name = name
    dept.faculty = (data.faculty or "").strip() or None
    await db.commit()
    await db.refresh(dept)
    users_count_res = await db.execute(
        select(func.count(User.id_user)).where(User.id_department == dept.id_department)
    )
    bup_count_res = await db.execute(
        select(func.count(BupDiscipline.id_bup_discipline)).where(BupDiscipline.id_department == dept.id_department)
    )
    return DepartmentOut(
        id_department=dept.id_department, name=dept.name, faculty=dept.faculty,
        users_count=users_count_res.scalar_one() or 0,
        bup_disciplines_count=bup_count_res.scalar_one() or 0,
    )

@router.delete("/departments/{dept_id}", status_code=204)
async def delete_department(
    dept_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_dept_admin(user)
    dept = await get_or_404(db, Department, dept_id, "Подразделение не найдено")
    users_res = await db.execute(
        select(func.count(User.id_user)).where(User.id_department == dept_id)
    )
    users_used = users_res.scalar_one() or 0
    if users_used > 0:
        raise HTTPException(
            status_code=400,
            detail=f"К подразделению привязано {users_used} пользователь(ей). Перенесите их в другое подразделение перед удалением.",
        )
    await db.execute(
        update(BupDiscipline).where(BupDiscipline.id_department == dept_id).values(id_department=None)
    )
    await db.delete(dept)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Не удалось удалить подразделение: на него ссылаются другие записи. " + str(e),
        )

@router.get("/users/search", response_model=list[ReviewerCandidateOut])
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
        ReviewerCandidateOut(
            id_user=u.id_user, full_name=u.full_name, title=u.title,
            role=u.role.name if u.role else "",
            department=u.department.name if u.department else "",
        )
        for u in rows
    ]
