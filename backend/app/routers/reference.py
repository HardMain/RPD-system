from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, user_can
from app.core.database import get_db
from app.models import AssessmentTool, User
from pydantic import BaseModel

class AssessmentToolOut(BaseModel):
    id_assessment_tool: int
    name: str

    class Config:
        from_attributes = True

class AssessmentToolCreate(BaseModel):
    name: str

router = APIRouter(prefix="/api/assessment-tools", tags=["reference"])

@router.get("/", response_model=list[AssessmentToolOut])
async def list_assessment_tools(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(AssessmentTool).order_by(AssessmentTool.name))
    return res.scalars().all()

@router.post("/", response_model=AssessmentToolOut, status_code=201)
async def create_assessment_tool(
    data: AssessmentToolCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user_can(user, "reference.manage"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Пустое имя")
    existing = await db.execute(select(AssessmentTool).where(AssessmentTool.name == name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Такое средство оценки уже есть")
    tool = AssessmentTool(name=name)
    db.add(tool)
    await db.commit()
    await db.refresh(tool)
    return tool
