from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.database import engine, Base, async_session
from app.core.auth import hash_password
from app.models.user import (
    Role, Department, User, Direction, Discipline, Competency,
    CompetencyIndicator, DisciplineCompetency, Rpd, RpdSection, RpdTopic,
    RpdLiterature, RpdSoftware, RpdMaterialTech, RpdDatabase, RpdLearningOutcome,
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
        comp7 = Competency(
            id_direction=dir1.id_direction, code="ОПК-7",
            name="Способен применять в практической деятельности основные концепции, принципы, теории и факты, связанные с информатикой",
        )
        db.add_all([comp1, comp2, comp3, comp7])
        await db.flush()

        ci1 = CompetencyIndicator(id_competency=comp1.id_competency, code="ОПК-1.1", description="Применяет методы математического анализа и моделирования")
        ci2 = CompetencyIndicator(id_competency=comp1.id_competency, code="ОПК-1.2", description="Использует основные законы естественных наук")
        ci3 = CompetencyIndicator(id_competency=comp2.id_competency, code="ИД-1ОПК-2", description="Знает принципы работы современных информационных технологий и программных средств, в том числе отечественного производства")
        ci4 = CompetencyIndicator(id_competency=comp2.id_competency, code="ИД-2ОПК-2", description="Умеет выбирать современные информационные технологии и программные средства, в том числе отечественного производства при решении задач профессиональной деятельности")
        ci4b = CompetencyIndicator(id_competency=comp2.id_competency, code="ИД-3ОПК-2", description="Владеет навыками применения современных информационных технологий и программных средств, в том числе отечественного производства, при решении задач профессиональной деятельности")
        ci5 = CompetencyIndicator(id_competency=comp3.id_competency, code="ПК-1.1", description="Разрабатывает требования к программному обеспечению")
        ci7a = CompetencyIndicator(id_competency=comp7.id_competency, code="ИД-1ОПК-7", description="Знает основные концепции, принципы, теории и факты, связанные с информатикой")
        ci7b = CompetencyIndicator(id_competency=comp7.id_competency, code="ИД-2ОПК-7", description="Умеет применять основные концепции, принципы, теории и факты, связанные с информатикой, в практической деятельности")
        ci7c = CompetencyIndicator(id_competency=comp7.id_competency, code="ИД-3ОПК-7", description="Владеет навыками практического применения основных концепций, принципов, теорий и фактов, связанных с информатикой")
        db.add_all([ci1, ci2, ci3, ci4, ci4b, ci5, ci7a, ci7b, ci7c])
        await db.flush()

        # ── Disciplines ──
        d_inf = Discipline(id_direction=dir1.id_direction, code="Б1.О.15", name="Информатика", semester="1, 2", total_hours=252, lecture_hours=26, practice_hours=0, lab_hours=56, self_study_hours=126, control_form="Экзамен, зачёт")
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
            DisciplineCompetency(id_discipline=d_inf.id_discipline, id_competency=comp7.id_competency),
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
            goals_text=(
                "Целью изучения дисциплины является приобретение систематических знаний в области "
                "теоретических основ информатики (хранение, передача и обработка информации, представление "
                "информации в компьютере), умений эффективного использования информационных средств и "
                "ресурсов, ознакомление с основами современных информационных технологий и тенденциями их "
                "развития."
            ),
            tasks_text=(
                "Задачами учебной дисциплины являются:\n"
                "Изучение:\n"
                "- основы теории информации: понятие информации и её свойства, данные;\n"
                "- основные способы и методы накопления, передачи и обработки информации в современных цифровых и микропроцессорных системах;\n"
                "- технические и программные средства реализации информационных технологий;\n"
                "- современные языки программирования, базы данных, программное обеспечение и технологии программирования;\n"
                "- глобальные и локальные компьютерные сети;\n"
                "- стандартные программные средства для решения задач в сфере профессиональной деятельности;\n"
                "- технологию работы на персональном компьютере в современных операционных средах, основные методы разработки алгоритмов и программ, структуры данных, используемые для представления типовых информационных объектов, типовые алгоритмы обработки данных.\n"
                "\n"
                "Формирование умений:\n"
                "- использовать возможности вычислительной техники и программного обеспечения;\n"
                "- работать на персональном компьютере, пользоваться операционной системой и основными офисными приложениями.\n"
                "\n"
                "Формирование навыков:\n"
                "- методами практического использования современных компьютеров для обработки информации;\n"
                "- методами поиска и обмена информацией в глобальных и локальных компьютерных сетях;\n"
                "- основными методами и приёмами работы с прикладными программными средствами персональной электронно-вычислительной машины;\n"
                "- навыками применения стандартных программных средств в сфере профессиональной деятельности;\n"
                "- приёмами создания, хранения, воспроизведения, обработки и передачи данных средствами вычислительной техники;\n"
                "- принципами функционирования средств вычислительной техники и методами управления ими."
            ),
            objects_text=(
                "- аппаратное обеспечение средств вычислительной техники;\n"
                "- программное обеспечение средств вычислительной техники;\n"
                "- средства взаимодействия аппаратного и программного обеспечения;\n"
                "- средства взаимодействия человека с аппаратными и программными средствами."
            ),
            requirements_text="Не предусмотрены.",
            educational_tech=(
                "Проведение лекционных занятий по дисциплине основывается на активном методе обучения, при котором учащиеся не пассивные слушатели, а активные участники занятия, отвечающие на вопросы преподавателя. Вопросы преподавателя нацелены на активизацию процессов усвоения материала, а также на развитие логического мышления. Преподаватель заранее намечает список вопросов, стимулирующих ассоциативное мышление и установление связей с ранее освоенным материалом.\n"
                "Проведение лабораторных занятий основывается на интерактивном методе обучения, при котором обучающиеся взаимодействуют не только с преподавателем, но и друг с другом. При этом доминирует активность учащихся в процессе обучения. Место преподавателя в интерактивных занятиях сводится к направлению деятельности обучающихся на достижение целей занятия.\n"
                "При проведении учебных занятий используются интерактивные лекции, групповые дискуссии, ролевые игры, тренинги и анализ ситуаций и имитационных моделей."
            ),
            methodical_recommendations=(
                "При изучении дисциплины обучающимся целесообразно выполнять следующие рекомендации:\n"
                "1. Изучение учебной дисциплины должно вестись систематически.\n"
                "2. После изучения какого-либо раздела по учебнику или конспектным материалам рекомендуется по памяти воспроизвести основные термины, определения, понятия раздела.\n"
                "3. Особое внимание следует уделить выполнению отчётов по практическим занятиям, лабораторным работам и индивидуальным комплексным заданиям на самостоятельную работу.\n"
                "4. Вся тематика вопросов, изучаемых самостоятельно, задаётся на лекциях преподавателем. Им же даются источники (в первую очередь вновь изданные в периодической научной литературе) для более детального понимания вопросов, озвученных на лекции."
            ),
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

        # ── Sections for rpd4 (Информатика, архивная) — по примеру из ПНИПУ ──
        inf_sections = [
            # 1 семестр
            ("Основные понятия теории информации",
             "Цели и задачи информатики. Понятие информации, общая характеристика процессов сбора, передачи, обработки и накопления информации. Свойства информации. Данные. Операции с данными. Кодирование текстовых, числовых, графических данных. Основные структуры: линейные, табличные, иерархические. Системы счисления. Единицы представления, измерения и хранения данных.",
             1, 0, 2, 6),
            ("Технические средства реализации информационных процессов",
             "Краткая история развития ЭВМ. Поколения ЭВМ. Классификации компьютеров: по назначению, уровню специализации, типоразмерам, совместимости и др. Базовая конфигурация современного персонального компьютера.",
             2, 0, 2, 8),
            ("Программные средства реализации информационных процессов",
             "Программное обеспечение, его уровни. Классификация программного обеспечения. Направления развития и эволюции программных средств. Понятие об операционной системе (ОС). Классификация ОС. Функции ОС. Файлы и файловая структура.",
             2, 0, 2, 8),
            ("Разработка программной документации",
             "Работа в текстовом процессоре. Режимы отображения. Создание документа: форматирование текста, проверка правописания, тезаурус, автоформат и автозамена. Вставка рисунков, формул и таблиц. Создание презентаций. Использование шаблонов. Создание электронных таблиц. Типы данных, ввод, редактирование и форматирование. Простейшие вычисления, использование стандартных функций. Построение диаграмм и графиков.",
             1, 0, 2, 8),
            ("Алгоритмы и алгоритмизация",
             "Понятие алгоритма. Формы представления алгоритмов. Графический способ представления алгоритмов. Линейные, разветвлённые и циклические алгоритмы. Вложенные и параллельные алгоритмы. Построение алгоритма из базовых структур. Пошаговая детализация как метод проектирования алгоритмов.",
             2, 0, 4, 12),
            ("Программные средства реализации алгоритмов",
             "Языки программирования. Алгоритмизация и программирование. Синтаксис и семантика. Трансляция, интерпретация и компиляция программ. Тестирование программ. Программирование алгоритмов.",
             2, 0, 4, 12),
            ("Пакеты прикладных программ",
             "Математические, графические пакеты прикладных программ.",
             2, 0, 4, 12),
            ("Базы данных",
             "Базы данных (БД) и базы знаний. Назначение БД. Основные понятия реляционных баз данных: поля и записи, свойства полей, типы данных, системы управления БД. Проектирование и обработка БД.",
             2, 0, 4, 8),
            ("Телекоммуникации",
             "Локальные и глобальные сети ЭВМ. Сетевые протоколы. Сетевые службы. Основы работы в Интернете. Основные службы Интернета.",
             2, 0, 4, 8),
            ("Методы и средства защиты информации",
             "Понятие компьютерной безопасности и защита сведений, составляющих государственную тайну. Компьютерные вирусы: классификация, методы и средства антивирусной защиты. Защита информации в Интернете. Понятие о шифровании. Принцип достаточности защиты. Электронная подпись.",
             2, 0, 4, 8),
            # 2 семестр
            ("Технологии программирования",
             "Понятие программного продукта. Жизненный цикл программного обеспечения. Проектирование, программирование, отладка, документирование, сопровождение и эксплуатация программных средств. Стратегии разработки и отладки. Переносимость программ. Экономические, организационные и правовые вопросы создания программного и информационного обеспечения. Понятие интеллектуальной собственности.",
             4, 0, 4, 6),
            ("Структурное и объектно-ориентированное программирование",
             "Структурное программирование. Объектно-ориентированное программирование.",
             0, 0, 8, 12),
            ("Пакеты и средства обработки информации",
             "Математические, графические пакеты обработки информации. Системы компьютерной математики. Понятие о компьютерной графике. Растровая и векторная графика. Особенности трёхмерного векторного моделирования. Представление графических данных: основные форматы, цветовые модели. Средства создания и обработки графических изображений.",
             2, 0, 6, 10),
            ("Современные информационные технологии и их приложения",
             "Краткий обзор существующих информационных технологий. Их возможности и приложения.",
             2, 0, 6, 8),
        ]
        for i, (title, content, lec, prac, lab, srs) in enumerate(inf_sections, 1):
            db.add(RpdSection(id_rpd=rpd4.id_rpd, section_number=i, title=title, brief_content=content,
                              lecture_hours=lec, practice_hours=prac, lab_hours=lab, self_study_hours=srs))
        await db.flush()

        # ── Тематика лабораторных работ для rpd4 ──
        lab_topic_titles = [
            "Разработка программной документации",
            "Линейные алгоритмы",
            "Разветвлённые алгоритмы",
            "Циклы",
            "Пакеты прикладных программ",
            "Работа с базами данных",
            "Решение задач с использованием методов структурного и объектно-ориентированного программирования",
            "Обработка информации в пакетах прикладных программ",
        ]
        # Привяжем темы к соответствующим разделам
        inf_secs_q = await db.execute(select(RpdSection).where(RpdSection.id_rpd == rpd4.id_rpd).order_by(RpdSection.section_number))
        inf_secs_list = list(inf_secs_q.scalars())
        lab_topic_mapping = [
            (4, lab_topic_titles[0]),   # Разработка программной документации
            (5, lab_topic_titles[1]),   # Линейные алгоритмы
            (5, lab_topic_titles[2]),   # Разветвлённые алгоритмы
            (5, lab_topic_titles[3]),   # Циклы
            (7, lab_topic_titles[4]),   # Пакеты прикладных программ
            (8, lab_topic_titles[5]),   # Работа с базами данных
            (12, lab_topic_titles[6]),  # Структурное и ООП
            (13, lab_topic_titles[7]),  # Обработка информации в пакетах
        ]
        for sec_num, title in lab_topic_mapping:
            if sec_num <= len(inf_secs_list):
                db.add(RpdTopic(id_section=inf_secs_list[sec_num - 1].id_section,
                                topic_type="lab", title=title))

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
        # Информатика — по примеру из ПНИПУ
        db.add_all([
            # Основная (печатная)
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type="Основная",
                          title="Информатика. Базовый курс: учебное пособие для втузов. 3-е изд.",
                          authors="Симонович С.В. и др.", year=2020, publisher="Санкт-Петербург: Питер",
                          copies_count=30),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type="Основная",
                          title="Информатика: учебник для вузов. 4-е изд., стер.",
                          authors="Острейковский В.А.", year=2007, publisher="Москва: Высшая школа",
                          copies_count=24),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type="Основная",
                          title="C/C++. Программирование на языке высокого уровня: учебник для вузов",
                          authors="Павловская Т.А.", year=2020, publisher="Санкт-Петербург: Питер",
                          copies_count=50),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type="Основная",
                          title="Информатика: учебное пособие",
                          authors="Щапова И.Н., Щапов В.А.", year=2016, publisher="Пермь: ПНИПУ",
                          copies_count=42),
            # Дополнительная (печатная + электронная)
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type="Дополнительная",
                          title="Компьютерные сети. Принципы, технологии, протоколы: учебное пособие для вузов. 4-е изд.",
                          authors="Олифер В.Г., Олифер Н.А.", year=2011, publisher="Санкт-Петербург: Питер",
                          copies_count=46),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type="Дополнительная",
                          title="C/C++. Структурное и объектно-ориентированное программирование: практикум",
                          authors="Павловская Т.А., Щупак Ю.А.", year=2011, publisher="Санкт-Петербург: Питер",
                          copies_count=14),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type="Дополнительная",
                          title="Язык программирования C [Электронный ресурс]",
                          authors="Керниган Б.В.", year=2017, publisher="IPRsmart",
                          url="http://www.iprbookshop.ru/73736.html"),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type="Дополнительная",
                          title="Язык программирования C++ для профессионалов [Электронный ресурс]",
                          authors="Страуструп Б.", year=2017, publisher="IPRsmart",
                          url="http://www.iprbookshop.ru/73737.html"),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type="Дополнительная",
                          title="Информатика. Базовый курс [Электронный ресурс]: учебное пособие",
                          authors="Денисова Э.В.", year=2017, publisher="IPRsmart",
                          url="http://www.iprbookshop.ru/66475.html"),
        ])

        # ── Software for rpd4 (Информатика) ──
        db.add_all([
            RpdSoftware(id_rpd=rpd4.id_rpd, name="Debian", license_type="GNU GPL", purpose="Операционные системы"),
            RpdSoftware(id_rpd=rpd4.id_rpd, name="Windows 10", license_type="Azure Dev Tools for Teaching", purpose="Операционные системы"),
            RpdSoftware(id_rpd=rpd4.id_rpd, name="LibreOffice 6.2.4", license_type="OpenSource, бесплатен", purpose="Офисные приложения"),
            RpdSoftware(id_rpd=rpd4.id_rpd, name="Protege", license_type="Свободное ПО", purpose="Системы управления проектами, исследованиями, проектированием, моделированием"),
            RpdSoftware(id_rpd=rpd4.id_rpd, name="Microsoft Visual Studio", license_type="Azure Dev Tools for Teaching", purpose="Среды разработки, тестирования и отладки"),
            RpdSoftware(id_rpd=rpd4.id_rpd, name="MS Visual Studio 2019 Community", license_type="Free", purpose="Среды разработки, тестирования и отладки"),
            RpdSoftware(id_rpd=rpd4.id_rpd, name="PostgreSQL", license_type="PostgreSQL License", purpose="Среды разработки, тестирования и отладки"),
        ])

        # ── Material-Tech for rpd4 ──
        db.add_all([
            RpdMaterialTech(id_rpd=rpd4.id_rpd, room_type="Лабораторная работа", equipment="Персональный компьютер", quantity=30),
            RpdMaterialTech(id_rpd=rpd4.id_rpd, room_type="Лекция", equipment="Мультимедийный проектор", quantity=1),
        ])

        # ── Базы данных и ИСС для rpd4 (стандартный перечень ПНИПУ) ──
        db.add_all([
            RpdDatabase(id_rpd=rpd4.id_rpd, name="База данных Elsevier «Freedom Collection»", url="https://www.elsevier.com/"),
            RpdDatabase(id_rpd=rpd4.id_rpd, name="База данных Springer Nature e-books", url="http://link.springer.com/"),
            RpdDatabase(id_rpd=rpd4.id_rpd, name="База данных научной электронной библиотеки (eLIBRARY.RU)", url="https://elibrary.ru/"),
            RpdDatabase(id_rpd=rpd4.id_rpd, name="Научная библиотека Пермского национального исследовательского политехнического университета", url="https://elib.pstu.ru/"),
            RpdDatabase(id_rpd=rpd4.id_rpd, name="Электронно-библиотечная система «Лань»", url="https://e.lanbook.com/"),
            RpdDatabase(id_rpd=rpd4.id_rpd, name="Электронно-библиотечная система IPRsmart", url="http://www.iprbookshop.ru/"),
            RpdDatabase(id_rpd=rpd4.id_rpd, name="Информационные ресурсы Сети КонсультантПлюс", url="локальная сеть"),
            RpdDatabase(id_rpd=rpd4.id_rpd, name="Информационно-справочная система нормативно-технической документации «Техэксперт: нормы, правила, стандарты и законодательства России»", url="http://325290.inkip.ru/docs"),
        ])

        # ── Learning outcomes for rpd4 (ОПК-2, ОПК-7) ──
        db.add_all([
            RpdLearningOutcome(id_rpd=rpd4.id_rpd, id_indicator=ci3.id_indicator,
                               outcome_text="Знает современные информационные технологии и программные средства отечественного и зарубежного производства, способные решать задачи в рамках заданной предметной области",
                               assessment_tool="Экзамен"),
            RpdLearningOutcome(id_rpd=rpd4.id_rpd, id_indicator=ci4.id_indicator,
                               outcome_text="Умеет оценивать и принимать решения о применении современных информационных технологий и программных средств отечественного и зарубежного производства для решения задач в рамках заданной предметной области",
                               assessment_tool="Защита лабораторной работы"),
            RpdLearningOutcome(id_rpd=rpd4.id_rpd, id_indicator=ci4b.id_indicator,
                               outcome_text="Владеет навыками применения современных информационных технологий и программных средств отечественного и зарубежного производства при решении задач в рамках заданной предметной области",
                               assessment_tool="Защита лабораторной работы"),
            RpdLearningOutcome(id_rpd=rpd4.id_rpd, id_indicator=ci7a.id_indicator,
                               outcome_text="Знает ключевые концепции, принципы, понятия, метапонятия, связанные с информатикой и необходимые в профессиональной деятельности",
                               assessment_tool="Экзамен"),
            RpdLearningOutcome(id_rpd=rpd4.id_rpd, id_indicator=ci7b.id_indicator,
                               outcome_text="Умеет применять основные концепции, принципы, теории и факты, связанные с информатикой, для решения задач в рамках предметной области",
                               assessment_tool="Защита лабораторной работы"),
            RpdLearningOutcome(id_rpd=rpd4.id_rpd, id_indicator=ci7c.id_indicator,
                               outcome_text="Владеет навыками применения основных концепций, принципов, теорий и фактов, связанных с информатикой, при решении задач в рамках предметной области",
                               assessment_tool="Экзамен"),
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
        db.add(RpdDeveloper(id_rpd=rpd4.id_rpd, id_user=teacher.id_user))

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
