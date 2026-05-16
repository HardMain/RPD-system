import base64

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import verify_password, hash_password, create_access_token, get_current_user, user_permission_codes
from app.models.user import User, Role, RolePermission
from app.models import StoredFile
from app.schemas import ChangePasswordRequest, LoginRequest, ProfileUpdate, TokenResponse, UserOut
from app.services import storage_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

AVATAR_MIME = {"image/png", "image/jpeg", "image/webp", "image/gif"}
AVATAR_MAX_BYTES = 1_500_000

async def _user_out(db: AsyncSession, user: User) -> UserOut:
    avatar_data_url = None
    if user.id_avatar_file:
        sf = await db.get(StoredFile, user.id_avatar_file)
        if sf:
            try:
                raw = storage_service.read_bytes(sf.storage_uri)
                b64 = base64.b64encode(raw).decode("ascii")
                avatar_data_url = f"data:{sf.mime or 'image/png'};base64,{b64}"
            except (FileNotFoundError, ValueError):
                avatar_data_url = None
    return UserOut(
        id_user=user.id_user,
        full_name=user.full_name,
        title=user.title,
        email=user.email,
        role=user.role.name if user.role else "",
        department=user.department.name if user.department else "",
        avatar_color=user.avatar_color,
        avatar_data_url=avatar_data_url,
        theme=user.theme or "light",
        permissions=sorted(user_permission_codes(user)),
    )

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
    return TokenResponse(access_token=token, user=await _user_out(db, user))

@router.post("/change-password", status_code=204)
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(data.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Текущий пароль неверный")
    new_pw = (data.new_password or "").strip()
    if len(new_pw) < 4:
        raise HTTPException(status_code=400, detail="Новый пароль слишком короткий (минимум 4 символа)")
    if verify_password(new_pw, user.password_hash):
        raise HTTPException(status_code=400, detail="Новый пароль совпадает с текущим")
    user.password_hash = hash_password(new_pw)
    await db.commit()

@router.get("/me", response_model=UserOut)
async def me(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    return await _user_out(db, user)

@router.patch("/me", response_model=UserOut)
async def update_me(
    data: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if data.email is not None:
        email = data.email.strip()
        if email and "@" not in email:
            raise HTTPException(status_code=400, detail="Некорректный e-mail")
        user.email = email or None
    if data.avatar_color is not None:
        user.avatar_color = data.avatar_color.strip() or None
    if data.theme is not None:
        theme = data.theme.strip().lower()
        if theme not in ("light", "dark"):
            raise HTTPException(status_code=400, detail="Неизвестная тема")
        user.theme = theme
    await db.commit()
    return await _user_out(db, user)

@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mime = (file.content_type or "").lower()
    if mime not in AVATAR_MIME:
        raise HTTPException(status_code=400, detail="Ожидается изображение (PNG, JPEG, WEBP или GIF)")
    content = await file.read()
    if len(content) > AVATAR_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Файл слишком большой (максимум 1.5 МБ)")

    old_id = user.id_avatar_file
    storage_uri, size = storage_service.save_bytes("avatar", file.filename or "avatar", content)
    sf = StoredFile(
        kind="avatar", original_name=file.filename or "avatar", mime=mime,
        size_bytes=size, storage_uri=storage_uri, id_uploaded_by=user.id_user,
    )
    db.add(sf)
    await db.flush()
    user.id_avatar_file = sf.id_file
    if old_id:
        old = await db.get(StoredFile, old_id)
        if old:
            storage_service.delete(old.storage_uri)
            await db.delete(old)
    await db.commit()
    return await _user_out(db, user)

@router.delete("/me/avatar", response_model=UserOut)
async def delete_avatar(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    old_id = user.id_avatar_file
    user.id_avatar_file = None
    if old_id:
        old = await db.get(StoredFile, old_id)
        if old:
            storage_service.delete(old.storage_uri)
            await db.delete(old)
    await db.commit()
    return await _user_out(db, user)
