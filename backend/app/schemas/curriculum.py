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
    """Логическая дисциплина (справочник имён, независимый от направления).

    Контекст направления/часов/семестра живёт в BupDiscipline. Поля часов
    остались опциональными — некоторые эндпоинты заполняют их из
    «представительной» BupDiscipline для совместимости с UI, который
    привык получать всё в одном объекте.
    """
    id_discipline: int
    name: str
    code: str | None = None
    semester: str | None = None
    total_hours: int | None = None
    lecture_hours: int | None = None
    practice_hours: int | None = None
    lab_hours: int | None = None
    self_study_hours: int | None = None
    control_form: str | None = None

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
    """Backwards-compat: сейчас под капотом тянем из BupDiscipline-связки,
    схема ответа осталась прежней."""
    id_competency: int
    code: str
    name: str
    indicators: list[IndicatorOut] = []
