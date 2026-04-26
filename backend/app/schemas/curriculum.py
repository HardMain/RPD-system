"""Curriculum schemas: directions, disciplines, competencies."""
from __future__ import annotations
from pydantic import BaseModel


class DirectionOut(BaseModel):
    id_direction: int
    code: str
    name: str
    profile: str | None = None
    degree_level: str | None = None

    class Config:
        from_attributes = True


class DisciplineOut(BaseModel):
    id_discipline: int
    id_direction: int
    code: str | None = None
    name: str
    semester: str | None = None
    total_hours: int | None = None
    lecture_hours: int | None = None
    practice_hours: int | None = None
    lab_hours: int | None = None
    self_study_hours: int | None = None
    control_form: str | None = None
    direction_name: str | None = None
    direction_code: str | None = None

    class Config:
        from_attributes = True


class IndicatorOut(BaseModel):
    id_indicator: int
    code: str
    description: str

    class Config:
        from_attributes = True


class CompetencyOut(BaseModel):
    id_competency: int
    code: str
    name: str
    indicators: list[IndicatorOut] = []

    class Config:
        from_attributes = True


class DisciplineCompetencyOut(BaseModel):
    id_competency: int
    code: str
    name: str
    indicators: list[IndicatorOut] = []
