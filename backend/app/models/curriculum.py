"""Curriculum-domain models: directions, disciplines, competencies and indicators.

Discipline здесь — это *логический* справочник имён дисциплин по направлению.
Атрибуты часов, семестра, формы контроля и закрепления компетенций живут
в `BupDiscipline` (см. `app.models.bup`), потому что они зависят от пары
(дисциплина, БУП), а не только от дисциплины.
"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Direction(Base):
    __tablename__ = "directions"
    id_direction = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(20), nullable=False)
    name = Column(String(200), nullable=False)
    profile = Column(String(200))
    degree_level = Column(String(50))

    disciplines = relationship("Discipline", back_populates="direction")
    competencies = relationship("Competency", back_populates="direction")
    bups = relationship("Bup", back_populates="direction", cascade="all, delete-orphan")


class Discipline(Base):
    __tablename__ = "disciplines"
    id_discipline = Column(Integer, primary_key=True, autoincrement=True)
    id_direction = Column(Integer, ForeignKey("directions.id_direction"), nullable=False)
    name = Column(String(200), nullable=False)

    direction = relationship("Direction", back_populates="disciplines")
    rpds = relationship("Rpd", back_populates="discipline")
    bup_disciplines = relationship("BupDiscipline", back_populates="discipline")


class Competency(Base):
    __tablename__ = "competencies"
    id_competency = Column(Integer, primary_key=True, autoincrement=True)
    id_direction = Column(Integer, ForeignKey("directions.id_direction"), nullable=False)
    code = Column(String(20), nullable=False)
    name = Column(Text, nullable=False)

    direction = relationship("Direction", back_populates="competencies")
    indicators = relationship("CompetencyIndicator", back_populates="competency")
    bup_discipline_links = relationship("BupDisciplineCompetency", back_populates="competency")


class CompetencyIndicator(Base):
    __tablename__ = "competency_indicators"
    id_indicator = Column(Integer, primary_key=True, autoincrement=True)
    id_competency = Column(Integer, ForeignKey("competencies.id_competency"), nullable=False)
    code = Column(String(20), nullable=False)
    description = Column(Text, nullable=False)

    competency = relationship("Competency", back_populates="indicators")
