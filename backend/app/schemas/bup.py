"""BUP schemas: учебный план, дисциплина БУП, закрепление компетенций."""
from __future__ import annotations
from pydantic import BaseModel

from app.schemas.curriculum import IndicatorOut


class BupDisciplineCompetencyOut(BaseModel):
    """Закрепление компетенции в конкретном БУПе (с индикаторами)."""
    id_competency: int
    code: str
    name: str
    indicators: list[IndicatorOut] = []


class BupDisciplineOut(BaseModel):
    id_bup_discipline: int
    id_bup: int
    id_discipline: int
    discipline_name: str
    code: str | None = None
    semester: str | None = None
    control_form: str | None = None
    total_hours: int | None = None
    lecture_hours: int | None = None
    lab_hours: int | None = None
    practice_hours: int | None = None
    ksr_hours: int | None = None
    self_study_hours: int | None = None
    zet: int | None = None
    department_name: str | None = None

    class Config:
        from_attributes = True


class BupOut(BaseModel):
    id_bup: int
    id_direction: int
    name: str
    year: int | None = None
    faculty: str | None = None
    profile: str | None = None
    direction_code: str | None = None
    direction_name: str | None = None

    class Config:
        from_attributes = True


class BupDetailOut(BupOut):
    disciplines: list[BupDisciplineOut] = []
