"""Curriculum-domain models: directions, disciplines, competencies and links."""
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


class Discipline(Base):
    __tablename__ = "disciplines"
    id_discipline = Column(Integer, primary_key=True, autoincrement=True)
    id_direction = Column(Integer, ForeignKey("directions.id_direction"), nullable=False)
    code = Column(String(20))
    name = Column(String(200), nullable=False)
    semester = Column(String(20))
    total_hours = Column(Integer)
    lecture_hours = Column(Integer)
    practice_hours = Column(Integer)
    lab_hours = Column(Integer)
    self_study_hours = Column(Integer)
    control_form = Column(String(50))

    direction = relationship("Direction", back_populates="disciplines")
    rpds = relationship("Rpd", back_populates="discipline")
    discipline_competencies = relationship("DisciplineCompetency", back_populates="discipline")


class Competency(Base):
    __tablename__ = "competencies"
    id_competency = Column(Integer, primary_key=True, autoincrement=True)
    id_direction = Column(Integer, ForeignKey("directions.id_direction"), nullable=False)
    code = Column(String(20), nullable=False)
    name = Column(Text, nullable=False)
    direction = relationship("Direction", back_populates="competencies")
    indicators = relationship("CompetencyIndicator", back_populates="competency")
    discipline_competencies = relationship("DisciplineCompetency", back_populates="competency")


class CompetencyIndicator(Base):
    __tablename__ = "competency_indicators"
    id_indicator = Column(Integer, primary_key=True, autoincrement=True)
    id_competency = Column(Integer, ForeignKey("competencies.id_competency"), nullable=False)
    code = Column(String(20), nullable=False)
    description = Column(Text, nullable=False)
    competency = relationship("Competency", back_populates="indicators")


class DisciplineCompetency(Base):
    __tablename__ = "discipline_competencies"
    id_discipline_competency = Column(Integer, primary_key=True, autoincrement=True)
    id_discipline = Column(Integer, ForeignKey("disciplines.id_discipline"), nullable=False)
    id_competency = Column(Integer, ForeignKey("competencies.id_competency"), nullable=False)
    discipline = relationship("Discipline", back_populates="discipline_competencies")
    competency = relationship("Competency", back_populates="discipline_competencies")
