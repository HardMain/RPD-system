from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.database import engine, Base, async_session
from app.core.auth import hash_password
from app.models.user import (
    Role, Department, User, Direction, Discipline, Competency,
    CompetencyIndicator, DisciplineCompetency, Rpd, RpdSection,
    RpdLiterature, RpdSoftware, RpdMaterialTech, RpdLearningOutcome,
    RpdDeveloper, Notification,
)
from app.routers import auth, rpd, llm, notifications
from app.routers import competencies, upload, export, admin


async def seed_data():
    """Populate database with demo data matching the prototype."""
    async with async_session() as db:
        existing = await db.execute(select(Role))
        if existing.scalars().first():
            return

        # ── Roles ──
        r_teacher = Role(name="Преподаватель")
        r_head = Role(name="Зав. кафедрой")
        r_umu = Role(name="Сотрудник УМУ")
        r_admin = Role(name="Администратор")
        db.add_all([r_teacher, r_head, r_umu, r_admin])
        await db.flush()

        # ── Department ──
        dept = Department(
            name="Информационных технологий и автоматизированных систем",
            faculty="Электротехнический факультет",
        )
        db.add(dept)
        await db.flush()

        # ── Users ──
        pwd = hash_password("password")
        teacher = User(
            id_role=r_teacher.id_role, id_department=dept.id_department,
            ldap_uid="ivanov", full_name="Иванов Иван Иванович",
            email="ivanov@pstu.ru", password_hash=pwd,
        )
        teacher2 = User(
            id_role=r_teacher.id_role, id_department=dept.id_department,
            ldap_uid="kozlova", full_name="Козлова Мария Сергеевна",
            email="kozlova@pstu.ru", password_hash=pwd,
        )
        head = User(
            id_role=r_head.id_role, id_department=dept.id_department,
            ldap_uid="petrov", full_name="Петров Пётр Петрович",
            email="petrov@pstu.ru", password_hash=pwd,
        )
        admin_user = User(
            id_role=r_admin.id_role, id_department=dept.id_department,
            ldap_uid="admin", full_name="Сидоров Алексей Михайлович",
            email="admin@pstu.ru", password_hash=pwd,
        )
        db.add_all([teacher, teacher2, head, admin_user])
        await db.flush()

        # ── Direction ──
        dir1 = Direction(
            code="09.03.04", name="Программная инженерия",
            profile="Разработка программно-информационных систем",
            degree_level="бакалавриат",
        )
        db.add(dir1)
        await db.flush()

        # ── Competencies ──
        comp1 = Competency(
            id_direction=dir1.id_direction, code="ОПК-1",
            name="Способен применять естественнонаучные и общеинженерные знания, методы математического анализа и моделирования",
        )
        comp2 = Competency(
            id_direction=dir1.id_direction, code="ОПК-2",
            name="Способен использовать современные информационные технологии и программные средства",
        )
        comp3 = Competency(
            id_direction=dir1.id_direction, code="ПК-1",
            name="Способен разрабатывать требования и проектировать программное обеспечение",
        )
        db.add_all([comp1, comp2, comp3])
        await db.flush()

        ci1 = CompetencyIndicator(id_competency=comp1.id_competency, code="ОПК-1.1", description="Применяет методы математического анализа и моделирования")
        ci2 = CompetencyIndicator(id_competency=comp1.id_competency, code="ОПК-1.2", description="Использует основные законы естественных наук")
        ci3 = CompetencyIndicator(id_competency=comp2.id_competency, code="ОПК-2.1", description="Использует современные ИТ для решения задач профессиональной деятельности")
        ci4 = CompetencyIndicator(id_competency=comp2.id_competency, code="ОПК-2.2", description="Применяет инструментальные средства разработки ПО")
        ci5 = CompetencyIndicator(id_competency=comp3.id_competency, code="ПК-1.1", description="Разрабатывает требования к программному обеспечению")
        db.add_all([ci1, ci2, ci3, ci4, ci5])
        await db.flush()

        # ── Disciplines ──
        d_inf = Discipline(id_direction=dir1.id_direction, code="Б1.О.15", name="Информатика", semester="1, 2", total_hours=180, lecture_hours=36, practice_hours=18, lab_hours=36, self_study_hours=90, control_form="Экзамен")
        d_kg = Discipline(id_direction=dir1.id_direction, code="Б1.О.22", name="Компьютерная графика", semester="5", total_hours=252, lecture_hours=36, practice_hours=0, lab_hours=54, self_study_hours=162, control_form="Зачёт с оценкой")
        d_phys = Discipline(id_direction=dir1.id_direction, code="Б1.О.08", name="Физика", semester="1, 2", total_hours=144, lecture_hours=36, practice_hours=18, lab_hours=18, self_study_hours=72, control_form="Экзамен")
        d_db = Discipline(id_direction=dir1.id_direction, code="Б1.О.20", name="Базы данных", semester="3", total_hours=180, lecture_hours=36, practice_hours=18, lab_hours=36, self_study_hours=90, control_form="Экзамен")
        d_algo = Discipline(id_direction=dir1.id_direction, code="Б1.О.19", name="Алгоритмы и структуры данных", semester="3, 4", total_hours=216, lecture_hours=36, practice_hours=36, lab_hours=36, self_study_hours=108, control_form="Экзамен")
        db.add_all([d_inf, d_kg, d_phys, d_db, d_algo])
        await db.flush()

        # ── Discipline-Competency links ──
        db.add_all([
            DisciplineCompetency(id_discipline=d_inf.id_discipline, id_competency=comp1.id_competency),
            DisciplineCompetency(id_discipline=d_inf.id_discipline, id_competency=comp2.id_competency),
            DisciplineCompetency(id_discipline=d_kg.id_discipline, id_competency=comp2.id_competency),
            DisciplineCompetency(id_discipline=d_kg.id_discipline, id_competency=comp3.id_competency),
            DisciplineCompetency(id_discipline=d_phys.id_discipline, id_competency=comp1.id_competency),
            DisciplineCompetency(id_discipline=d_db.id_discipline, id_competency=comp2.id_competency),
            DisciplineCompetency(id_discipline=d_db.id_discipline, id_competency=comp3.id_competency),
            DisciplineCompetency(id_discipline=d_algo.id_discipline, id_competency=comp1.id_competency),
            DisciplineCompetency(id_discipline=d_algo.id_discipline, id_competency=comp2.id_competency),
        ])
        await db.flush()

        # ── RPDs ──
        rpd1 = Rpd(id_discipline=d_inf.id_discipline, id_author=teacher.id_user, academic_year="2025/2026", status="Черновик")
        rpd2 = Rpd(
            id_discipline=d_kg.id_discipline, id_author=teacher.id_user,
            academic_year="2025/2026", status="На доработке",
            goals_text="Целью изучения дисциплины «Компьютерная графика» является формирование у обучающихся знаний и навыков в области методов и алгоритмов компьютерной графики, обработки изображений и визуализации данных.",
            tasks_text="Задачи дисциплины:\n- изучение математических основ компьютерной графики;\n- освоение алгоритмов растеризации и визуализации;\n- приобретение навыков работы с графическими библиотеками (OpenGL, WebGL);\n- разработка интерактивных графических приложений.",
            objects_text="Растровая и векторная графика, 2D/3D-преобразования, модели освещения, текстурирование, графический конвейер.",
            requirements_text="Для изучения дисциплины необходимы знания линейной алгебры, аналитической геометрии и основ программирования на C++/Python.",
            educational_tech="Лекции с мультимедийным сопровождением, лабораторные работы с применением OpenGL/WebGL, самостоятельная работа с учебно-методическими материалами.",
            methodical_recommendations="Рекомендуется начинать с изучения 2D-примитивов, затем переходить к 3D-трансформациям. Лабораторные работы выполняются последовательно с нарастанием сложности.",
        )
        rpd3 = Rpd(
            id_discipline=d_phys.id_discipline, id_author=teacher.id_user,
            academic_year="2025/2026", status="На согласовании",
            goals_text="Целью изучения дисциплины «Физика» является формирование у обучающихся фундаментальных знаний в области физических законов и явлений.",
            tasks_text="Задачи дисциплины:\n- изучение основных законов механики, термодинамики, электричества;\n- формирование навыков решения физических задач;\n- развитие физического мышления.",
            objects_text="Механика, термодинамика, электродинамика, оптика, квантовая физика.",
            requirements_text="Для изучения дисциплины необходимы знания школьного курса физики и математики.",
            educational_tech="Лекции с демонстрацией экспериментов, практические занятия по решению задач, лабораторные работы.",
            methodical_recommendations="Каждая лабораторная работа требует предварительной подготовки теоретической части.",
        )
        rpd4 = Rpd(
            id_discipline=d_inf.id_discipline, id_author=teacher.id_user,
            academic_year="2024/2025", status="Согласовано",
            goals_text="Целью изучения дисциплины «Информатика» является приобретение систематических знаний в области теоретических основ информатики.",
            tasks_text="Задачи:\n- изучение основ теории информации;\n- освоение основных способов обработки информации;\n- приобретение навыков программирования на языках высокого уровня.",
            objects_text="Информационные процессы, данные, алгоритмы, программные средства обработки информации.",
            requirements_text="Знания школьного курса математики и информатики.",
            educational_tech="Лекции с мультимедийным сопровождением, лабораторные работы в компьютерных классах.",
            methodical_recommendations="Рекомендуется последовательное освоение материала. Лабораторные работы выполняются в парах.",
        )
        db.add_all([rpd1, rpd2, rpd3, rpd4])
        await db.flush()

        # ── Sections for rpd2 (КГ) ──
        kg_sections = [
            ("Введение в компьютерную графику", "История, классификация, области применения КГ.", 4, 0, 4, 16),
            ("Растровая графика", "Алгоритмы растеризации, заполнение областей.", 6, 0, 8, 24),
            ("Геометрические преобразования", "Аффинные преобразования, матрицы поворота, масштабирования.", 8, 0, 10, 30),
            ("3D-визуализация", "Проекции, модели освещения, текстурирование.", 10, 0, 16, 46),
            ("Графический конвейер", "Стадии конвейера, шейдеры, GPU-программирование.", 8, 0, 16, 46),
        ]
        for i, (title, content, lec, prac, lab, srs) in enumerate(kg_sections, 1):
            db.add(RpdSection(id_rpd=rpd2.id_rpd, section_number=i, title=title, brief_content=content,
                              lecture_hours=lec, practice_hours=prac, lab_hours=lab, self_study_hours=srs))

        # ── Sections for rpd3 (Физика) ──
        phys_sections = [
            ("Кинематика", "Основные понятия кинематики, виды движения.", 4, 2, 2, 8),
            ("Динамика", "Законы Ньютона, силы в природе.", 4, 2, 2, 8),
            ("Работа и энергия", "Теоремы об энергии, законы сохранения.", 4, 2, 2, 8),
            ("Термодинамика", "Начала термодинамики, тепловые процессы.", 4, 2, 2, 8),
            ("Электростатика", "Закон Кулона, электрическое поле.", 4, 2, 2, 8),
            ("Постоянный ток", "Закон Ома, законы Кирхгофа.", 4, 2, 2, 8),
            ("Электромагнетизм", "Магнитное поле, электромагнитная индукция.", 4, 2, 2, 8),
            ("Оптика", "Геометрическая и волновая оптика, интерференция.", 4, 2, 2, 8),
            ("Квантовая физика", "Фотоэффект, атом Бора, волны де Бройля.", 4, 2, 2, 8),
        ]
        for i, (title, content, lec, prac, lab, srs) in enumerate(phys_sections, 1):
            db.add(RpdSection(id_rpd=rpd3.id_rpd, section_number=i, title=title, brief_content=content,
                              lecture_hours=lec, practice_hours=prac, lab_hours=lab, self_study_hours=srs))

        # ── Sections for rpd4 (Информатика, архивная) ──
        inf_sections = [
            ("Введение в информатику", "Основные понятия информатики, системы счисления.", 4, 4, 0, 8),
            ("Архитектура ЭВМ", "Структура и принципы работы компьютера.", 6, 2, 4, 10),
            ("Программирование", "Алгоритмы, языки программирования, ООП.", 8, 4, 8, 12),
            ("Базы данных", "Реляционная модель, SQL, проектирование БД.", 6, 4, 8, 20),
            ("Сети и интернет", "Сетевые протоколы, веб-технологии.", 6, 2, 8, 20),
            ("Информационная безопасность", "Основы защиты информации, криптография.", 6, 2, 8, 20),
        ]
        for i, (title, content, lec, prac, lab, srs) in enumerate(inf_sections, 1):
            db.add(RpdSection(id_rpd=rpd4.id_rpd, section_number=i, title=title, brief_content=content,
                              lecture_hours=lec, practice_hours=prac, lab_hours=lab, self_study_hours=srs))

        # ── Literature ──
        # КГ
        db.add_all([
            RpdLiterature(id_rpd=rpd2.id_rpd, source_type="Основная", title="Компьютерная графика и геометрическое моделирование", authors="Никулин Е.А.", year=2021, publisher="БХВ-Петербург"),
            RpdLiterature(id_rpd=rpd2.id_rpd, source_type="Основная", title="Основы компьютерной графики", authors="Шикин Е.В., Боресков А.В.", year=2020, publisher="Диалог-МИФИ"),
            RpdLiterature(id_rpd=rpd2.id_rpd, source_type="Дополнительная", title="OpenGL. Программирование компьютерной графики", authors="Боресков А.В.", year=2019, publisher="Питер"),
        ])
        # Физика
        db.add_all([
            RpdLiterature(id_rpd=rpd3.id_rpd, source_type="Основная", title="Курс общей физики. Т. 1-3", authors="Савельев И.В.", year=2020, publisher="Лань"),
            RpdLiterature(id_rpd=rpd3.id_rpd, source_type="Основная", title="Курс физики", authors="Трофимова Т.И.", year=2019, publisher="Академия"),
            RpdLiterature(id_rpd=rpd3.id_rpd, source_type="Дополнительная", title="Задачи по общей физике", authors="Иродов И.Е.", year=2021, publisher="Бином"),
        ])
        # Информатика
        db.add_all([
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type="Основная", title="Информатика: учебник", authors="Советов Б.Я.", year=2020, publisher="Высшая школа"),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type="Основная", title="Основы программирования", authors="Столяров А.В.", year=2021, publisher="МЦНМО"),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type="Дополнительная", title="Информатика и ИТ", authors="Гаврилов М.В.", year=2022, publisher="Юрайт"),
        ])

        # ── Software for rpd2 (КГ) ──
        db.add_all([
            RpdSoftware(id_rpd=rpd2.id_rpd, name="Visual Studio Code", license_type="Свободное ПО", purpose="Редактор кода"),
            RpdSoftware(id_rpd=rpd2.id_rpd, name="Blender", license_type="GPL", purpose="3D-моделирование"),
        ])

        # ── Material-Tech for rpd3 ──
        db.add_all([
            RpdMaterialTech(id_rpd=rpd3.id_rpd, room_type="Лекционная аудитория", equipment="Проектор, экран, компьютер преподавателя"),
            RpdMaterialTech(id_rpd=rpd3.id_rpd, room_type="Физическая лаборатория", equipment="Лабораторные стенды, измерительные приборы"),
        ])

        # ── Learning outcomes for rpd3 ──
        db.add_all([
            RpdLearningOutcome(id_rpd=rpd3.id_rpd, id_indicator=ci1.id_indicator,
                               outcome_text="Применяет методы физического анализа при решении инженерных задач",
                               assessment_tool="Экзамен"),
            RpdLearningOutcome(id_rpd=rpd3.id_rpd, id_indicator=ci2.id_indicator,
                               outcome_text="Использует основные законы физики для объяснения процессов в технических системах",
                               assessment_tool="Лабораторная работа"),
        ])

        # ── Developers ──
        db.add(RpdDeveloper(id_rpd=rpd2.id_rpd, id_user=teacher.id_user))
        db.add(RpdDeveloper(id_rpd=rpd3.id_rpd, id_user=teacher.id_user))

        # ── Notifications ──
        db.add_all([
            Notification(id_user=teacher.id_user, id_rpd=rpd3.id_rpd, message="РПД Физика отправлена на согласование", is_read=False),
            Notification(id_user=teacher.id_user, id_rpd=rpd4.id_rpd, message="РПД Информатика согласована", is_read=False),
            Notification(id_user=teacher.id_user, id_rpd=rpd2.id_rpd, message="РПД Компьютерная графика возвращена на доработку", is_read=True),
        ])

        await db.commit()
        print("✅ Seed data created successfully")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_data()
    yield


app = FastAPI(
    title="ИС формирования РПД",
    description="Информационная система формирования рабочих программ дисциплин на основе методов NLP",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(auth.router)
app.include_router(rpd.router)
app.include_router(competencies.router)
app.include_router(llm.router)
app.include_router(upload.router)
app.include_router(export.router)
app.include_router(notifications.router)
app.include_router(admin.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ИС РПД", "version": "1.0.0"}
