"""BUP-domain models: учебный план + дисциплина БУП + закрепление компетенций.

Концепция:
- `Bup` — конкретный базовый учебный план (год, факультет, направление, профиль).
- `BupDiscipline` — дисциплина в *этом* плане, со всеми атрибутами (часы по
  семестрам, форма контроля, кафедра). 3НФ: атрибуты часов зависят от пары
  (логическая дисциплина, БУП), поэтому хранятся здесь, а не в `Discipline`.
- `BupDisciplineCompetency` — закрепление компетенции *в данном плане*.
- `RpdBupDiscipline` — М:N между РПД и дисциплинами БУП (одна РПД может быть
  прикреплена к нескольким дисциплинам разных БУПов, как в АРМ).
"""
from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class Bup(Base):
    __tablename__ = "bups"
    id_bup = Column(Integer, primary_key=True, autoincrement=True)
    id_direction = Column(Integer, ForeignKey("directions.id_direction"), nullable=False)
    name = Column(String(300), nullable=False)
    year = Column(Integer)
    faculty = Column(String(150))
    profile = Column(String(200))
    id_source_file = Column(Integer, ForeignKey("stored_files.id_file"), nullable=True)

    direction = relationship("Direction", back_populates="bups")
    source_file = relationship("StoredFile", foreign_keys=[id_source_file])
    disciplines = relationship(
        "BupDiscipline", back_populates="bup", cascade="all, delete-orphan",
        order_by="BupDiscipline.code",
    )


class BupDiscipline(Base):
    __tablename__ = "bup_disciplines"
    id_bup_discipline = Column(Integer, primary_key=True, autoincrement=True)
    id_bup = Column(Integer, ForeignKey("bups.id_bup"), nullable=False)
    id_discipline = Column(Integer, ForeignKey("disciplines.id_discipline"), nullable=False)
    id_department = Column(Integer, ForeignKey("departments.id_department"), nullable=True)

    code = Column(String(30))                # Б1.Б.01, Б1.В.05 и т.п.
    semester = Column(String(30))            # «1», «1, 2», …
    control_form = Column(String(255))       # «Экзамен», «Зачёт», «Экзамен, зачёт» и т.п.

    total_hours = Column(Integer)            # Общая трудоёмкость, ак.час
    lecture_hours = Column(Integer)          # Лекции
    lab_hours = Column(Integer)              # Лабораторные
    practice_hours = Column(Integer)         # Практические
    ksr_hours = Column(Integer)              # КСР
    self_study_hours = Column(Integer)       # СРС
    zet = Column(Integer)                    # Зачётные единицы

    bup = relationship("Bup", back_populates="disciplines")
    discipline = relationship("Discipline", back_populates="bup_disciplines")
    department = relationship("Department")
    competencies = relationship(
        "BupDisciplineCompetency",
        back_populates="bup_discipline",
        cascade="all, delete-orphan",
    )
    # БЕЗ cascade: при hard-delete БУПа админ-эндпоинт сам нуллит
    # `RpdBupDiscipline.id_bup_discipline` (предварительно записав снапшот),
    # чтобы у уже созданных РПД сохранилась информация о плане.
    rpd_links = relationship(
        "RpdBupDiscipline",
        back_populates="bup_discipline",
    )


class BupDisciplineCompetency(Base):
    __tablename__ = "bup_discipline_competencies"
    id_bup_discipline_competency = Column(Integer, primary_key=True, autoincrement=True)
    id_bup_discipline = Column(Integer, ForeignKey("bup_disciplines.id_bup_discipline"), nullable=False)
    id_competency = Column(Integer, ForeignKey("competencies.id_competency"), nullable=False)

    __table_args__ = (
        UniqueConstraint("id_bup_discipline", "id_competency", name="uq_bup_disc_comp"),
    )

    bup_discipline = relationship("BupDiscipline", back_populates="competencies")
    competency = relationship("Competency", back_populates="bup_discipline_links")


class RpdBupDiscipline(Base):
    """Связка РПД ↔ дисциплина БУПа со снапшотом всех значимых полей плана.

    Зачем снапшот: админ может удалить БУП. После hard-delete `id_bup_discipline`
    зануляется (и сам ряд BupDiscipline уходит), но печатная форма РПД, часы,
    направление и т.п. должны продолжать рендериться. Snapshot заполняется
    в момент привязки/обновления; при чтении приоритет всегда у snapshot
    (если он не пустой), иначе — резолв через `bup_discipline`.
    """
    __tablename__ = "rpd_bup_disciplines"
    id_rpd_bup_discipline = Column(Integer, primary_key=True, autoincrement=True)
    id_rpd = Column(Integer, ForeignKey("rpd.id_rpd"), nullable=False)
    id_bup_discipline = Column(
        Integer, ForeignKey("bup_disciplines.id_bup_discipline", ondelete="SET NULL"),
        nullable=True,
    )

    # Snapshot БУПа и направления
    bup_name = Column(String(300))
    bup_year = Column(Integer)
    bup_profile = Column(String(200))
    direction_code = Column(String(20))
    direction_name = Column(String(200))
    direction_profile = Column(String(200))
    fgos_file_id = Column(Integer)
    fgos_file_name = Column(String(300))
    # Snapshot самой BupDiscipline
    code = Column(String(30))
    semester = Column(String(30))
    control_form = Column(String(255))
    total_hours = Column(Integer)
    lecture_hours = Column(Integer)
    lab_hours = Column(Integer)
    practice_hours = Column(Integer)
    ksr_hours = Column(Integer)
    self_study_hours = Column(Integer)
    zet = Column(Integer)
    # Имя логической дисциплины — на случай, если её тоже удалят (например когда
    # она использовалась только этим планом).
    discipline_name = Column(String(200))

    __table_args__ = (
        UniqueConstraint("id_rpd", "id_bup_discipline", name="uq_rpd_bup_disc"),
    )

    rpd = relationship("Rpd", back_populates="bup_links")
    bup_discipline = relationship("BupDiscipline", back_populates="rpd_links")
