from collections import defaultdict
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import async_session
from app.core.auth import hash_password
from app.models import (
    Role, Department, User, Direction, Discipline, Competency,
    CompetencyIndicator, AssessmentTool, Rpd, RpdSection, RpdTopic,
    RpdLiterature, RpdSoftware, RpdMaterialTech, RpdDatabase, RpdLearningOutcome,
    RpdDeveloper, Notification,
    Bup, BupDiscipline, BupDisciplineCompetency, RpdBupDiscipline,
    Permission, RolePermission, RpdApprovalRoute, LlmPrompt,
)
from app.models.dictionary import DictionaryEntry
from app.services.bup_parser import parse_bup_xls
from app.services.bup_importer import import_parsed_bup

SEED_BUPS_DIR = Path(__file__).resolve().parent.parent / "seed_data" / "bups"
SEED_BUP_FILES = [
    "2015 МТФ_ТАМП_б (полный).xls",
    "2015_ГумФ_ГМУ_б (полный).xls",
    "2015_ГумФ_ОПД_б (полный).xls",
]

async def seed_reference():
    async with async_session() as db:
        existing = await db.execute(select(AssessmentTool))
        if existing.scalars().first():
            return
        for name in [
            "Экзамен",
            "Зачёт",
            "Дифференцированный зачёт",
            "Защита лабораторной работы",
            "Защита практической работы",
            "Защита курсовой работы",
            "Защита курсового проекта",
            "Защита практики",
            "Контрольная работа",
            "Реферат",
            "Тест",
            "Собеседование",
            "Доклад",
            "Эссе",
        ]:
            db.add(AssessmentTool(name=name))
        await db.commit()

PERMISSION_CATALOG: list[tuple[str, str]] = [
    ("*", "Полный доступ ко всем операциям системы"),
    ("rpd.create", "Создание новых РПД"),
    ("rpd.approve", "Согласование и отклонение РПД"),
    ("rpd.delete_any", "Удаление РПД любого автора"),
    ("rpd.edit_meta", "Редактирование мета-параметров чужих РПД (направление, профиль, часы, семестры)"),
    ("approval_chain.edit", "Изменение маршрута согласования чужих РПД"),
    ("users.manage", "Управление пользователями (создание, редактирование, деактивация)"),
    ("users.create", "Создание пользователей в рамках своего scope"),
    ("sources.manage", "Управление источниками данных: БУПы, направления, справочники, документы"),
]

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "Преподаватель": [],
    "Зав. кафедрой": ["rpd.approve"],
    "Сотрудник УМУ": ["rpd.create", "sources.manage"],
    "Начальник отдела УМУ": ["rpd.create", "rpd.approve", "rpd.edit_meta", "approval_chain.edit", "sources.manage"],
    "Начальник управления УМУ": ["rpd.create", "rpd.approve", "rpd.edit_meta", "approval_chain.edit", "sources.manage"],
    "Проректор": ["rpd.approve"],
    "Ректор": ["rpd.approve"],
    "Техник УМУ": ["rpd.create", "rpd.edit_meta", "approval_chain.edit", "rpd.delete_any", "users.create", "sources.manage"],
    "Техник кафедры": ["rpd.create", "rpd.edit_meta", "approval_chain.edit", "users.create", "sources.manage"],
    "Администратор": ["*"],
}

async def seed_permissions():
    async with async_session() as db:
        existing = await db.execute(select(Permission))
        if existing.scalars().first():
            return

        perms_by_code: dict[str, Permission] = {}
        for code, desc in PERMISSION_CATALOG:
            p = Permission(code=code, description=desc)
            db.add(p)
            perms_by_code[code] = p
        await db.flush()

        roles_res = await db.execute(select(Role))
        roles_by_name = {r.name: r for r in roles_res.scalars().all()}

        for role_name, perm_codes in ROLE_PERMISSIONS.items():
            role = roles_by_name.get(role_name)
            if not role:
                continue
            for pc in perm_codes:
                p = perms_by_code.get(pc)
                if p:
                    db.add(RolePermission(id_role=role.id_role, id_permission=p.id_permission))

        await db.commit()
        print("✅ Permissions seeded")

DEFAULT_LLM_PROMPTS: list[dict] = [
    {
        "section_key": "goals",
        "section_label": "1.1 Цели и задачи дисциплины",
        "is_structural": False,
        "order_index": 1,
        "description": "Свободный текст: цель + задачи. Структуру брать из примера, если есть.",
        "user_prompt_template": (
            "Сформулируй раздел «Цели и задачи дисциплины» для РПД.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\nПрофиль: {profile}\n\n"
            "Если в дополнительных материалах ниже есть пример этого же раздела по другой дисциплине — "
            "точно повтори его структуру (подзаголовки, тип списка, длину). Меняй только содержание под новую дисциплину.\n"
            "Если примера нет — сформулируй цель (1-2 предложения) и задачи (5-7 пунктов маркированным списком)."
        ),
    },
    {
        "section_key": "objects",
        "section_label": "1.2 Изучаемые объекты дисциплины",
        "is_structural": False,
        "order_index": 2,
        "description": "Свободный текст: перечень изучаемых понятий и областей.",
        "user_prompt_template": (
            "Сформулируй раздел «Изучаемые объекты дисциплины» для РПД.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n\n"
            "Если в дополнительных материалах есть пример того же раздела по другой дисциплине — "
            "повтори его структуру и стиль. Иначе — перечисли основные понятия, объекты и области, "
            "изучаемые в рамках дисциплины."
        ),
    },
    {
        "section_key": "requirements",
        "section_label": "1.3 Входные требования",
        "is_structural": False,
        "order_index": 3,
        "description": "Свободный текст: пререквизиты — какие дисциплины и компетенции нужны.",
        "user_prompt_template": (
            "Сформулируй раздел «Входные требования» (пререквизиты) для РПД.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n\n"
            "Если в дополнительных материалах есть пример того же раздела — повтори его структуру.\n"
            "Иначе — укажи какие дисциплины должны быть изучены до начала данного курса и какие компетенции необходимы."
        ),
    },
    {
        "section_key": "learning_outcomes",
        "section_label": "2. Планируемые результаты обучения",
        "is_structural": True,
        "order_index": 4,
        "description": "JSON: результаты обучения, привязанные к индикаторам компетенций.",
        "user_prompt_template": (
            "Сгенерируй результаты обучения по дисциплине, привязанные к индикаторам компетенций.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n\n"
            "Если в дополнительных материалах есть пример того же раздела по другой дисциплине — "
            "повтори его стиль формулировок и подбор средств оценки. Подставляй содержание под новую дисциплину.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"indicator_code\": \"ИД-1ОК-1\", \"outcome_text\": \"...\", \"assessment_tool\": \"...\"}}]"
        ),
    },
    {
        "section_key": "content",
        "section_label": "4. Содержание дисциплины",
        "is_structural": True,
        "order_index": 5,
        "description": "JSON: 8-12 разделов с темами и часами по видам работ. Сумма часов должна совпадать с планом БУПа.",
        "user_prompt_template": (
            "Сгенерируй содержание дисциплины: 8-12 разделов с кратким описанием каждого.\n"
            "Для каждого раздела укажи: название, краткое содержание (1-2 предложения), часы по видам.\n\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\nВсего часов: {total_hours}\n"
            "Плановые часы по всей дисциплине: лекции {lecture_hours}, практики {practice_hours}, "
            "лабораторные {lab_hours}, СРС {self_study_hours}.\n\n"
            "{semesters_plan}\n\n"
            "Правила распределения часов:\n"
            "- Сумма часов всех разделов по каждому виду работ ДОЛЖНА точно совпадать с плановыми.\n"
            "- НЕ делай одинаковые часы у всех разделов — распределяй реалистично.\n"
            "- НЕ сваливай весь остаток в последний раздел.\n"
            "- Типичный диапазон: 2-6 лекционных часов на раздел, более трудоёмкие разделы получают больше.\n\n"
            "Если в дополнительных материалах есть пример раздела «Содержание» по другой дисциплине — "
            "повтори его подход: похожие по объёму разделы, тот же уровень детализации описания. Содержание подбирай под новую дисциплину.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"title\": \"...\", \"brief_content\": \"...\", \"lecture_hours\": N, \"practice_hours\": N, "
            "\"lab_hours\": N, \"self_study_hours\": N, \"semester\": N}}]"
        ),
    },
    {
        "section_key": "topics_practice",
        "section_label": "4.1 Тематика практических занятий",
        "is_structural": True,
        "order_index": 6,
        "description": "JSON: список тем практических, по 2-4 часа на тему.",
        "user_prompt_template": (
            "Сгенерируй тематики примерных практических занятий по дисциплине.\n"
            "Каждая тема занимает 2-4 часа. Сумма часов всех тем должна быть равна часам практик из БУПа.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\nЧасы практик: {practice_hours}\n\n"
            "Если в дополнительных материалах есть пример этого же раздела по другой дисциплине — "
            "повтори его стиль формулировок тем и уровень детализации описаний.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"title\": \"...\", \"hours\": N, \"description\": \"...\"}}]"
        ),
    },
    {
        "section_key": "topics_lab",
        "section_label": "4.2 Тематика лабораторных работ",
        "is_structural": True,
        "order_index": 7,
        "description": "JSON: список тем лабораторных, по 2-4 часа на работу.",
        "user_prompt_template": (
            "Сгенерируй тематики примерных лабораторных работ по дисциплине.\n"
            "Каждая работа занимает 2-4 часа. Сумма часов всех работ должна быть равна часам лабораторных из БУПа.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\nЧасы лабораторных: {lab_hours}\n\n"
            "Если в дополнительных материалах есть пример этого же раздела по другой дисциплине — "
            "повтори его стиль формулировок и уровень детализации.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"title\": \"...\", \"hours\": N, \"description\": \"...\"}}]"
        ),
    },
    {
        "section_key": "educational_tech",
        "section_label": "5.1 Образовательные технологии",
        "is_structural": False,
        "order_index": 8,
        "description": "Свободный текст: используемые технологии и методы обучения.",
        "user_prompt_template": (
            "Сформулируй раздел «Образовательные технологии» для РПД.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n"
            "Часы: лекции {lecture_hours}, практики {practice_hours}, лабораторные {lab_hours}, СРС {self_study_hours}\n\n"
            "Если в дополнительных материалах есть пример того же раздела — повтори его структуру.\n"
            "Иначе — опиши используемые технологии и методы обучения с учётом распределения часов."
        ),
    },
    {
        "section_key": "methodical_recommendations",
        "section_label": "5.2 Методические указания",
        "is_structural": False,
        "order_index": 9,
        "description": "Свободный текст: рекомендации обучающимся по освоению дисциплины.",
        "user_prompt_template": (
            "Сформулируй раздел «Методические рекомендации для обучающихся» для РПД.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n\n"
            "Если в дополнительных материалах есть пример того же раздела — повтори его структуру.\n"
            "Иначе — включи рекомендации по подготовке к лекциям, лабораторным, самостоятельной работе."
        ),
    },
    {
        "section_key": "literature_printed_main",
        "section_label": "6.1.1 Основная литература (печатная)",
        "is_structural": True,
        "order_index": 10,
        "description": "JSON: только реально существующие учебники, без выдуманных ISBN.",
        "user_prompt_template": (
            "Предложи 3-5 источников основной печатной литературы для дисциплины.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n\n"
            "ТОЛЬКО реально существующие книги. Если не уверен в существовании — пропусти. Не выдумывай.\n\n"
            "Если в дополнительных материалах есть раздел «Основная литература» по другой дисциплине — "
            "ориентируйся на тех же издателей и тот же стиль библиографического описания.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"title\": \"полное библиографическое описание (автор, заглавие, место, издательство, год)\", \"copies_count\": N}}]"
        ),
    },
    {
        "section_key": "literature_printed_additional",
        "section_label": "6.1.2.1 Дополнительная литература — учебные/научные",
        "is_structural": True,
        "order_index": 11,
        "description": "JSON: дополнительные учебные и научные издания. Только реальные.",
        "user_prompt_template": (
            "Предложи 2-4 дополнительных учебных и научных издания по дисциплине.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n\n"
            "ТОЛЬКО реально существующие книги. При сомнении — пропусти.\n\n"
            "Если в дополнительных материалах есть аналогичный подраздел — ориентируйся на тех же издателей и стиль описания.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"title\": \"полное библиографическое описание\", \"copies_count\": N}}]"
        ),
    },
    {
        "section_key": "literature_periodicals",
        "section_label": "6.1.2.2 Периодические издания",
        "is_structural": True,
        "order_index": 12,
        "description": "JSON: реальные научные журналы по теме дисциплины.",
        "user_prompt_template": (
            "Предложи 2-4 периодических научных издания (журналы) по дисциплине.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n\n"
            "ТОЛЬКО реально существующие журналы. При сомнении — пропусти.\n\n"
            "Если в дополнительных материалах есть подраздел «Периодические издания» — ориентируйся на тот же стиль и формат.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"title\": \"название журнала, ISSN, периодичность\", \"copies_count\": N}}]"
        ),
    },
    {
        "section_key": "literature_normative",
        "section_label": "6.1.2.3 Нормативно-технические издания",
        "is_structural": True,
        "order_index": 13,
        "description": "JSON: ГОСТы, СНиПы, нормативные документы. Только реально действующие.",
        "user_prompt_template": (
            "Предложи 1-3 нормативно-технических документа (ГОСТ, СНиП, ОСТ и т.п.) по дисциплине, если они применимы.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n\n"
            "ТОЛЬКО реально существующие документы. При сомнении — пропусти. Если по дисциплине нормативных документов нет — верни пустой массив [].\n\n"
            "Если в дополнительных материалах есть аналогичный подраздел — ориентируйся на стиль и формат.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"title\": \"номер и наименование документа\", \"copies_count\": N}}]"
        ),
    },
    {
        "section_key": "literature_methodical_students",
        "section_label": "6.1.3 Методические указания для студентов",
        "is_structural": True,
        "order_index": 14,
        "description": "JSON: методические указания, разработанные кафедрой. Чаще всего пусто.",
        "user_prompt_template": (
            "Предложи 1-2 методических указания для студентов по освоению дисциплины.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n\n"
            "Если у дисциплины обычно нет таких изданий — верни пустой массив [].\n\n"
            "Если в дополнительных материалах есть пример раздела — ориентируйся на его стиль.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"title\": \"...\", \"copies_count\": N}}]"
        ),
    },
    {
        "section_key": "literature_methodical_self_study",
        "section_label": "6.1.4 УМО самостоятельной работы",
        "is_structural": True,
        "order_index": 15,
        "description": "JSON: пособия для самостоятельной работы. Часто пусто.",
        "user_prompt_template": (
            "Предложи 1-2 пособия для самостоятельной работы студентов.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n\n"
            "Если у дисциплины обычно нет таких изданий — верни пустой массив [].\n\n"
            "Если в дополнительных материалах есть пример раздела — ориентируйся на его стиль.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"title\": \"...\", \"copies_count\": N}}]"
        ),
    },
    {
        "section_key": "literature_electronic",
        "section_label": "6.2 Электронная учебно-методическая литература",
        "is_structural": True,
        "order_index": 16,
        "description": "JSON: электронные ресурсы из ЭБС. source_type — вид литературы, availability — список ЭБС.",
        "user_prompt_template": (
            "Предложи 3-5 электронных источников по дисциплине из ЭБС.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n\n"
            "ТОЛЬКО реально существующие издания. URL должен указывать на действительный ресурс. При сомнении — пропусти.\n\n"
            "Поле source_type — вид литературы, одно из: «Учебные и научные издания», «Периодические издания», "
            "«Нормативно-технические издания», «Методические указания для студентов по освоению дисциплины», "
            "«Учебно-методическое обеспечение самостоятельной работы студента».\n\n"
            "Поле availability — массив из одной или нескольких строк, строго из списка: "
            "«ЭБС «Лань»», «ЭБС «Юрайт»», «ЭБС IPRsmart», «ЭБС «Znanium.com»», "
            "«ЭБС «Консультант студента»», «ЭБС «Университетская библиотека online»», "
            "«Научная библиотека ПНИПУ», «НЭБ eLIBRARY.RU», «Локальная сеть», «Свободный доступ».\n\n"
            "Если в дополнительных материалах есть пример раздела по электронной литературе — повтори стиль и набор ЭБС.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"source_type\": \"...\", \"title\": \"...\", \"url\": \"https://...\", \"availability\": [\"ЭБС ...\"]}}]"
        ),
    },
    {
        "section_key": "databases",
        "section_label": "6.3 БД и информационно-справочные системы",
        "is_structural": True,
        "order_index": 17,
        "description": "JSON: профессиональные БД и ИСС. db_type строго из каталога.",
        "user_prompt_template": (
            "Предложи 3-5 профессиональных баз данных и информационных справочных систем по дисциплине.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n\n"
            "Включай только реально существующие БД.\n\n"
            "Поле db_type должно быть строго одним из: "
            "«ЭБС», «Полнотекстовая», «Реферативная», «Информационно-справочная», «Нормативно-техническая», «Прочая».\n\n"
            "Если в дополнительных материалах есть пример раздела «БД и ИСС» — ориентируйся на тот же набор систем.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"db_type\": \"...\", \"name\": \"...\", \"url\": \"https://...\"}}]"
        ),
    },
    {
        "section_key": "software",
        "section_label": "6.4 Программное обеспечение",
        "is_structural": True,
        "order_index": 18,
        "description": "JSON: ПО для проведения занятий. license_type — вид ПО из каталога.",
        "user_prompt_template": (
            "Предложи 3-6 программных продуктов для проведения занятий по дисциплине.\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n\n"
            "Только реально существующее ПО.\n\n"
            "Поле license_type — вид ПО, строго одно из: "
            "«Операционные системы», «Офисные приложения», «Среды разработки», "
            "«Системы компьютерной математики», «Графические пакеты», «СУБД», "
            "«Антивирусное ПО», «Сетевое ПО», «Прочее прикладное ПО».\n\n"
            "Если в дополнительных материалах есть пример раздела «ПО» — ориентируйся на тот же набор.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"license_type\": \"...\", \"name\": \"...\"}}]"
        ),
    },
    {
        "section_key": "material_tech",
        "section_label": "7. Материально-техническое обеспечение",
        "is_structural": True,
        "order_index": 19,
        "description": "JSON: помещения и оборудование, сгруппированные по типам.",
        "user_prompt_template": (
            "Предложи материально-техническое обеспечение дисциплины, сгруппированное по типам помещений (аудитория для лекций, компьютерный класс, лаборатория).\n"
            "Дисциплина: {discipline}\nНаправление: {direction}\n"
            "Часы: лекции {lecture_hours}, практики {practice_hours}, лабораторные {lab_hours}\n\n"
            "Если в дополнительных материалах есть пример раздела «МТО» — ориентируйся на ту же группировку помещений и формат описания оборудования.\n\n"
            "Формат ответа — строго JSON массив без пояснений до/после:\n"
            "[{{\"room_type\": \"...\", \"equipment\": \"...\", \"quantity\": N}}]"
        ),
    },
]


async def seed_llm_prompts():
    async with async_session() as db:
        existing = await db.execute(select(LlmPrompt.section_key))
        existing_keys = {row[0] for row in existing.all()}
        added = 0
        for spec in DEFAULT_LLM_PROMPTS:
            if spec["section_key"] in existing_keys:
                continue
            db.add(LlmPrompt(**spec))
            added += 1
        if added:
            await db.commit()
            print(f"✅ LLM prompts seeded ({added} new)")


REFERENCE_AWARE_MARKER = "Если в дополнительных материалах"
SEMESTERS_PLAN_MARKER = "{semesters_plan}"
_CATALOG_MARKERS: dict[str, str] = {
    "software": "Операционные системы",
    "databases": "Полнотекстовая",
    "literature_electronic": "ЭБС «Лань»",
}


def _prompt_needs_upgrade(row: LlmPrompt) -> bool:
    template = row.user_prompt_template or ""
    if REFERENCE_AWARE_MARKER not in template:
        return True
    if row.section_key == "content" and SEMESTERS_PLAN_MARKER not in template:
        return True
    marker = _CATALOG_MARKERS.get(row.section_key)
    if marker and marker not in template:
        return True
    return False


async def upgrade_llm_prompts_to_reference_aware():
    async with async_session() as db:
        defaults_by_key = {spec["section_key"]: spec for spec in DEFAULT_LLM_PROMPTS}
        result = await db.execute(select(LlmPrompt))
        rows = result.scalars().all()
        upgraded = 0
        for row in rows:
            if not _prompt_needs_upgrade(row):
                continue
            spec = defaults_by_key.get(row.section_key)
            if not spec:
                continue
            row.user_prompt_template = spec["user_prompt_template"]
            row.description = spec.get("description") or row.description
            row.is_structural = spec.get("is_structural", row.is_structural)
            upgraded += 1
        if upgraded:
            await db.commit()
            print(f"✅ LLM prompts upgraded ({upgraded} updated)")


SEED_FACULTIES = [
    "Аэрокосмический факультет",
    "Автодорожный факультет",
    "Горно-нефтяной факультет",
    "Гуманитарный факультет",
    "Механико-технологический факультет",
    "Строительный факультет",
    "Химико-технологический факультет",
    "Электротехнический факультет",
    "Факультет прикладной математики и механики",
    "Факультет промышленной безопасности",
    "Факультет менеджмента и бизнеса",
]

SEED_EMPLOYEE_TITLES = [
    "Ассистент",
    "Преподаватель",
    "Старший преподаватель",
    "Доцент",
    "Профессор",
    "Заведующий кафедрой",
    "Декан",
    "Проректор",
    "Ректор",
    "Начальник отдела",
    "Начальник управления",
    "Ведущий специалист",
    "Специалист",
]

SEED_DIRECTIONS = [
    ("01.03.02", "Прикладная математика и информатика"),
    ("01.03.04", "Прикладная математика"),
    ("02.03.03", "Математическое обеспечение и администрирование информационных систем"),
    ("03.03.02", "Физика"),
    ("04.03.01", "Химия"),
    ("08.03.01", "Строительство"),
    ("09.03.01", "Информатика и вычислительная техника"),
    ("09.03.02", "Информационные системы и технологии"),
    ("09.03.03", "Прикладная информатика"),
    ("09.03.04", "Программная инженерия"),
    ("10.03.01", "Информационная безопасность"),
    ("11.03.01", "Радиотехника"),
    ("11.03.02", "Инфокоммуникационные технологии и системы связи"),
    ("11.03.03", "Конструирование и технология электронных средств"),
    ("11.03.04", "Электроника и наноэлектроника"),
    ("12.03.01", "Приборостроение"),
    ("12.03.04", "Биотехнические системы и технологии"),
    ("13.03.01", "Теплоэнергетика и теплотехника"),
    ("13.03.02", "Электроэнергетика и электротехника"),
    ("13.03.03", "Энергетическое машиностроение"),
    ("15.03.01", "Машиностроение"),
    ("15.03.02", "Технологические машины и оборудование"),
    ("15.03.03", "Прикладная механика"),
    ("15.03.04", "Автоматизация технологических процессов и производств"),
    ("15.03.05", "Конструкторско-технологическое обеспечение машиностроительных производств"),
    ("15.03.06", "Мехатроника и робототехника"),
    ("18.03.01", "Химическая технология"),
    ("18.03.02", "Энерго- и ресурсосберегающие процессы в химической технологии, нефтехимии и биотехнологии"),
    ("19.03.01", "Биотехнология"),
    ("20.03.01", "Техносферная безопасность"),
    ("21.03.01", "Нефтегазовое дело"),
    ("21.03.02", "Землеустройство и кадастры"),
    ("22.03.01", "Материаловедение и технологии материалов"),
    ("23.03.01", "Технология транспортных процессов"),
    ("23.03.02", "Наземные транспортно-технологические комплексы"),
    ("23.03.03", "Эксплуатация транспортно-технологических машин и комплексов"),
    ("24.03.01", "Ракетные комплексы и космонавтика"),
    ("24.03.04", "Авиастроение"),
    ("24.03.05", "Двигатели летательных аппаратов"),
    ("27.03.01", "Стандартизация и метрология"),
    ("27.03.02", "Управление качеством"),
    ("27.03.03", "Системный анализ и управление"),
    ("27.03.04", "Управление в технических системах"),
    ("27.03.05", "Инноватика"),
    ("28.03.01", "Нанотехнологии и микросистемная техника"),
    ("38.03.01", "Экономика"),
    ("38.03.02", "Менеджмент"),
    ("38.03.03", "Управление персоналом"),
    ("38.03.04", "Государственное и муниципальное управление"),
    ("38.03.05", "Бизнес-информатика"),
    ("38.03.06", "Торговое дело"),
    ("39.03.01", "Социология"),
    ("40.03.01", "Юриспруденция"),
    ("41.03.04", "Политология"),
    ("42.03.01", "Реклама и связи с общественностью"),
    ("43.03.01", "Сервис"),
    ("43.03.02", "Туризм"),
    ("44.03.01", "Педагогическое образование"),
    ("45.03.02", "Лингвистика"),
    ("54.03.01", "Дизайн"),
]

async def seed_dictionary_entries():
    async with async_session() as db:
        async def seed_kind(kind, values):
            res = await db.execute(
                select(DictionaryEntry.value).where(DictionaryEntry.kind == kind)
            )
            present = {(v or "").strip().lower() for (v,) in res.all()}
            added = False
            for value in values:
                if value.strip().lower() in present:
                    continue
                db.add(DictionaryEntry(kind=kind, value=value, source="seed"))
                added = True
            return added

        results = [
            await seed_kind("faculty", SEED_FACULTIES),
            await seed_kind("employee_title", SEED_EMPLOYEE_TITLES),
        ]
        if any(results):
            await db.commit()

async def seed_federal_directions():
    async with async_session() as db:
        res = await db.execute(select(Direction.code))
        present = {(c or "").strip().lower() for (c,) in res.all()}
        added = False
        for code, name in SEED_DIRECTIONS:
            if code.strip().lower() in present:
                continue
            db.add(Direction(code=code, name=name, profile=None, degree_level="бакалавриат"))
            present.add(code.strip().lower())
            added = True
        if added:
            await db.commit()

async def seed_data():
    await seed_reference()
    await _seed_demo_data()
    await seed_federal_directions()
    await seed_permissions()
    await ensure_role_permissions()
    await seed_test_samples()
    await ensure_three_indicators_for_all_competencies()
    await seed_llm_prompts()
    await upgrade_llm_prompts_to_reference_aware()
    await seed_dictionary_entries()


async def ensure_three_indicators_for_all_competencies():
    async with async_session() as db:
        comps_res = await db.execute(
            select(Competency).options(selectinload(Competency.indicators))
        )
        added = 0
        for comp in comps_res.scalars().all():
            existing_codes = {i.code for i in comp.indicators}
            placeholders = [
                (f"ИД-1{comp.code}", "Знает… (требуется заполнение)"),
                (f"ИД-2{comp.code}", "Умеет… (требуется заполнение)"),
                (f"ИД-3{comp.code}", "Владеет… (требуется заполнение)"),
            ]
            for code, desc in placeholders:
                if code not in existing_codes:
                    db.add(CompetencyIndicator(
                        id_competency=comp.id_competency,
                        code=code,
                        description=desc,
                    ))
                    added += 1
        if added:
            await db.commit()


async def ensure_role_permissions():
    async with async_session() as db:
        roles_res = await db.execute(select(Role))
        roles_by_name = {r.name: r for r in roles_res.scalars().all()}
        perms_res = await db.execute(select(Permission))
        perms_by_code = {p.code: p for p in perms_res.scalars().all()}

        new_perms_added = False
        for code, desc in PERMISSION_CATALOG:
            if code not in perms_by_code:
                p = Permission(code=code, description=desc)
                db.add(p)
                perms_by_code[code] = p
                new_perms_added = True
        if new_perms_added:
            await db.flush()

        existing_res = await db.execute(select(RolePermission.id_role, RolePermission.id_permission))
        existing_pairs = {(r, p) for r, p in existing_res.all()}

        added = 0
        for role_name, codes in ROLE_PERMISSIONS.items():
            role = roles_by_name.get(role_name)
            if role is None:
                continue
            for code in codes:
                perm = perms_by_code.get(code)
                if perm is None:
                    continue
                key = (role.id_role, perm.id_permission)
                if key in existing_pairs:
                    continue
                db.add(RolePermission(id_role=role.id_role, id_permission=perm.id_permission))
                existing_pairs.add(key)
                added += 1
        if added or new_perms_added:
            await db.commit()


async def _seed_demo_data():
    async with async_session() as db:
        existing = await db.execute(select(Role))
        if existing.scalars().first():
            return

        r_teacher = Role(name="Преподаватель")
        r_head = Role(name="Зав. кафедрой")
        r_umu = Role(name="Сотрудник УМУ")
        r_umu_chief = Role(name="Начальник отдела УМУ")
        r_umu_dir = Role(name="Начальник управления УМУ")
        r_vice_rector = Role(name="Проректор")
        r_rector = Role(name="Ректор")
        r_tech_umu = Role(name="Техник УМУ")
        r_tech_dept = Role(name="Техник кафедры")
        r_admin = Role(name="Администратор")
        db.add_all([r_teacher, r_head, r_umu, r_umu_chief, r_umu_dir, r_vice_rector, r_rector, r_tech_umu, r_tech_dept, r_admin])
        await db.flush()

        dept = Department(
            name="Информационных технологий и автоматизированных систем",
            faculty="Электротехнический факультет",
        )
        dept_umu = Department(
            name="Учебно-методическое управление",
            faculty=None,
        )
        dept_rectorate = Department(
            name="Ректорат",
            faculty=None,
        )
        db.add_all([dept, dept_umu, dept_rectorate])
        await db.flush()

        pwd = hash_password("password")
        teacher = User(
            id_role=r_teacher.id_role, id_department=dept.id_department,
            login="ivanov", full_name="Иванов Иван Иванович",
            title="Доцент",
            email="ivanov@pstu.ru", password_hash=pwd,
        )
        teacher2 = User(
            id_role=r_teacher.id_role, id_department=dept.id_department,
            login="kozlova", full_name="Козлова Мария Сергеевна",
            title="Старший преподаватель",
            email="kozlova@pstu.ru", password_hash=pwd,
        )
        head = User(
            id_role=r_head.id_role, id_department=dept.id_department,
            login="petrov", full_name="Петров Пётр Петрович",
            title="Заведующий кафедрой, профессор",
            email="petrov@pstu.ru", password_hash=pwd,
        )
        admin_user = User(
            id_role=r_admin.id_role, id_department=dept.id_department,
            login="admin", full_name="Сидоров Алексей Михайлович",
            title="Системный администратор",
            email="admin@pstu.ru", password_hash=pwd,
        )
        umu_chief = User(
            id_role=r_umu_chief.id_role, id_department=dept_umu.id_department,
            login="solovieva", full_name="Соловьёва Ольга Викторовна",
            title="Начальник учебно-методического отдела",
            email="solovieva@pstu.ru", password_hash=pwd,
        )
        umu_dir = User(
            id_role=r_umu_dir.id_role, id_department=dept_umu.id_department,
            login="kuznetsov", full_name="Кузнецов Дмитрий Александрович",
            title="Начальник учебно-методического управления",
            email="kuznetsov@pstu.ru", password_hash=pwd,
        )
        vice_rector = User(
            id_role=r_vice_rector.id_role, id_department=dept_rectorate.id_department,
            login="orlov", full_name="Орлов Сергей Андреевич",
            title="Проректор по учебной работе",
            email="orlov@pstu.ru", password_hash=pwd,
        )
        rector = User(
            id_role=r_rector.id_role, id_department=dept_rectorate.id_department,
            login="rector", full_name="Беляев Анатолий Николаевич",
            title="Ректор",
            email="rector@pstu.ru", password_hash=pwd,
        )
        tech_umu = User(
            id_role=r_tech_umu.id_role, id_department=dept_umu.id_department,
            login="tech_umu", full_name="Васильева Анна Игоревна",
            title="Техник учебно-методического управления",
            email="tech_umu@pstu.ru", password_hash=pwd,
        )
        tech_dept = User(
            id_role=r_tech_dept.id_role, id_department=dept.id_department,
            login="tech_dept", full_name="Морозов Илья Викторович",
            title="Техник кафедры ИТАС",
            email="tech_dept@pstu.ru", password_hash=pwd,
        )
        db.add_all([teacher, teacher2, head, admin_user, umu_chief, umu_dir, vice_rector, rector, tech_umu, tech_dept])
        await db.flush()

        dir1 = Direction(
            code="09.03.04", name="Программная инженерия",
            profile="Разработка программно-информационных систем",
            degree_level="бакалавриат",
        )
        db.add(dir1)
        await db.flush()

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

        ci1 = CompetencyIndicator(id_competency=comp1.id_competency, code="ИД-1ОПК-1", description="Знает основные положения и методы математики, естественных и общеинженерных наук")
        ci2 = CompetencyIndicator(id_competency=comp1.id_competency, code="ИД-2ОПК-1", description="Умеет применять методы математического анализа и моделирования при решении профессиональных задач")
        ci2c = CompetencyIndicator(id_competency=comp1.id_competency, code="ИД-3ОПК-1", description="Владеет навыками применения методов математического анализа и моделирования к решению инженерных задач")
        ci3 = CompetencyIndicator(id_competency=comp2.id_competency, code="ИД-1ОПК-2", description="Знает принципы работы современных информационных технологий и программных средств, в том числе отечественного производства")
        ci4 = CompetencyIndicator(id_competency=comp2.id_competency, code="ИД-2ОПК-2", description="Умеет выбирать современные информационные технологии и программные средства, в том числе отечественного производства при решении задач профессиональной деятельности")
        ci4b = CompetencyIndicator(id_competency=comp2.id_competency, code="ИД-3ОПК-2", description="Владеет навыками применения современных информационных технологий и программных средств, в том числе отечественного производства, при решении задач профессиональной деятельности")
        ci5 = CompetencyIndicator(id_competency=comp3.id_competency, code="ИД-1ПК-1", description="Знает методы и средства анализа предметной области и формулирования требований к программному обеспечению")
        ci5b = CompetencyIndicator(id_competency=comp3.id_competency, code="ИД-2ПК-1", description="Умеет разрабатывать требования и проектировать архитектуру программного обеспечения")
        ci5c = CompetencyIndicator(id_competency=comp3.id_competency, code="ИД-3ПК-1", description="Владеет навыками разработки требований и проектирования программного обеспечения с использованием современных нотаций")
        ci7a = CompetencyIndicator(id_competency=comp7.id_competency, code="ИД-1ОПК-7", description="Знает основные концепции, принципы, теории и факты, связанные с информатикой")
        ci7b = CompetencyIndicator(id_competency=comp7.id_competency, code="ИД-2ОПК-7", description="Умеет применять основные концепции, принципы, теории и факты, связанные с информатикой, в практической деятельности")
        ci7c = CompetencyIndicator(id_competency=comp7.id_competency, code="ИД-3ОПК-7", description="Владеет навыками практического применения основных концепций, принципов, теорий и фактов, связанных с информатикой")
        db.add_all([ci1, ci2, ci2c, ci3, ci4, ci4b, ci5, ci5b, ci5c, ci7a, ci7b, ci7c])
        await db.flush()

        d_inf = Discipline(name="Информатика")
        d_kg = Discipline(name="Компьютерная графика")
        d_phys = Discipline(name="Физика")
        d_db = Discipline(name="Базы данных")
        d_algo = Discipline(name="Алгоритмы и структуры данных")
        db.add_all([d_inf, d_kg, d_phys, d_db, d_algo])
        await db.flush()

        bup1 = Bup(
            id_direction=dir1.id_direction,
            name="2024 ЭТФ ПИ б (полный)",
            year=2024,
            faculty="Электротехнический факультет",
            profile="Разработка программно-информационных систем",
        )
        db.add(bup1)
        await db.flush()

        bd_inf = BupDiscipline(
            id_bup=bup1.id_bup, id_discipline=d_inf.id_discipline,
            id_department=dept.id_department,
            code="Б1.О.15", semester="1, 2", control_form="Экзамен (2), Зачёт (1)",
            total_hours=252, exam_hours=36,
            lecture_hours=26, lab_hours=56, practice_hours=None,
            ksr_hours=None, self_study_hours=126, zet=7,
            semesters_data=[
                {"number": 1, "lecture": 18, "lab": 32, "practice": None, "ksr": None, "srs": 90},
                {"number": 2, "lecture": 8,  "lab": 24, "practice": None, "ksr": None, "srs": 36},
            ],
        )
        bd_kg = BupDiscipline(
            id_bup=bup1.id_bup, id_discipline=d_kg.id_discipline,
            id_department=dept.id_department,
            code="Б1.О.22", semester="5", control_form="Диф. зачет (5)",
            total_hours=252, lecture_hours=36, lab_hours=54, practice_hours=None,
            ksr_hours=None, self_study_hours=162, zet=7,
            semesters_data=[
                {"number": 5, "lecture": 36, "lab": 54, "practice": None, "ksr": None, "srs": 162},
            ],
        )
        bd_phys = BupDiscipline(
            id_bup=bup1.id_bup, id_discipline=d_phys.id_discipline,
            id_department=dept.id_department,
            code="Б1.О.08", semester="1, 2", control_form="Экзамен (2)",
            total_hours=144, exam_hours=36,
            lecture_hours=36, lab_hours=18, practice_hours=18,
            ksr_hours=None, self_study_hours=72, zet=4,
            semesters_data=[
                {"number": 1, "lecture": 18, "lab": 9, "practice": 9, "ksr": None, "srs": 36},
                {"number": 2, "lecture": 18, "lab": 9, "practice": 9, "ksr": None, "srs": 36},
            ],
        )
        bd_db = BupDiscipline(
            id_bup=bup1.id_bup, id_discipline=d_db.id_discipline,
            id_department=dept.id_department,
            code="Б1.О.20", semester="3", control_form="Экзамен (3)",
            total_hours=180, exam_hours=36,
            lecture_hours=36, lab_hours=36, practice_hours=18,
            ksr_hours=None, self_study_hours=90, zet=5,
            semesters_data=[
                {"number": 3, "lecture": 36, "lab": 36, "practice": 18, "ksr": None, "srs": 90},
            ],
        )
        bd_algo = BupDiscipline(
            id_bup=bup1.id_bup, id_discipline=d_algo.id_discipline,
            id_department=dept.id_department,
            code="Б1.О.19", semester="3, 4", control_form="Экзамен (4)",
            total_hours=216, exam_hours=36,
            lecture_hours=36, lab_hours=36, practice_hours=36,
            ksr_hours=None, self_study_hours=108, zet=6,
            semesters_data=[
                {"number": 3, "lecture": 18, "lab": 18, "practice": 18, "ksr": None, "srs": 54},
                {"number": 4, "lecture": 18, "lab": 18, "practice": 18, "ksr": None, "srs": 54},
            ],
        )
        db.add_all([bd_inf, bd_kg, bd_phys, bd_db, bd_algo])
        await db.flush()

        db.add_all([
            BupDisciplineCompetency(id_bup_discipline=bd_inf.id_bup_discipline, id_competency=comp1.id_competency),
            BupDisciplineCompetency(id_bup_discipline=bd_inf.id_bup_discipline, id_competency=comp2.id_competency),
            BupDisciplineCompetency(id_bup_discipline=bd_inf.id_bup_discipline, id_competency=comp7.id_competency),
            BupDisciplineCompetency(id_bup_discipline=bd_kg.id_bup_discipline, id_competency=comp2.id_competency),
            BupDisciplineCompetency(id_bup_discipline=bd_kg.id_bup_discipline, id_competency=comp3.id_competency),
            BupDisciplineCompetency(id_bup_discipline=bd_phys.id_bup_discipline, id_competency=comp1.id_competency),
            BupDisciplineCompetency(id_bup_discipline=bd_db.id_bup_discipline, id_competency=comp2.id_competency),
            BupDisciplineCompetency(id_bup_discipline=bd_db.id_bup_discipline, id_competency=comp3.id_competency),
            BupDisciplineCompetency(id_bup_discipline=bd_algo.id_bup_discipline, id_competency=comp1.id_competency),
            BupDisciplineCompetency(id_bup_discipline=bd_algo.id_bup_discipline, id_competency=comp2.id_competency),
        ])
        await db.flush()

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

        rpd_bd_pairs = [
            (rpd1, bd_inf), (rpd2, bd_kg), (rpd3, bd_phys), (rpd4, bd_inf),
        ]
        for r, bd in rpd_bd_pairs:
            db.add(RpdBupDiscipline(id_rpd=r.id_rpd, id_bup_discipline=bd.id_bup_discipline))
        await db.flush()

        single_rpd_routes = [
            (rpd1, "waiting"),
            (rpd2, "waiting"),
            (rpd4, "approved"),
        ]
        for r, st in single_rpd_routes:
            db.add(RpdApprovalRoute(
                id_rpd=r.id_rpd, step_order=0, id_reviewer=head.id_user, status=st,
            ))

        rpd3_chain = [
            (head.id_user, "approved"),
            (umu_chief.id_user, "pending"),
            (umu_dir.id_user, "waiting"),
            (vice_rector.id_user, "waiting"),
        ]
        for i, (uid, st) in enumerate(rpd3_chain):
            db.add(RpdApprovalRoute(
                id_rpd=rpd3.id_rpd, step_order=i, id_reviewer=uid, status=st,
            ))

        kg_sections = [
            ("Введение в компьютерную графику", "История, классификация, области применения КГ.", 4, 0, 4, 16),
            ("Растровая графика", "Алгоритмы растеризации, заполнение областей.", 6, 0, 8, 24),
            ("Геометрические преобразования", "Аффинные преобразования, матрицы поворота, масштабирования.", 8, 0, 10, 30),
            ("3D-визуализация", "Проекции, модели освещения, текстурирование.", 10, 0, 16, 46),
            ("Графический конвейер", "Стадии конвейера, шейдеры, GPU-программирование.", 8, 0, 16, 46),
        ]
        for i, (title, content, lec, prac, lab, srs) in enumerate(kg_sections, 1):
            db.add(RpdSection(id_rpd=rpd2.id_rpd, section_number=i, title=title, brief_content=content,
                              lecture_hours=lec, practice_hours=prac, lab_hours=lab, self_study_hours=srs,
                              semester=5))

        phys_sections = [
            (1, "Кинематика", "Основные понятия кинематики, виды движения.", 4, 2, 2, 8),
            (1, "Динамика", "Законы Ньютона, силы в природе.", 4, 2, 2, 8),
            (1, "Работа и энергия", "Теоремы об энергии, законы сохранения.", 4, 2, 2, 8),
            (1, "Термодинамика", "Начала термодинамики, тепловые процессы.", 3, 1, 2, 6),
            (1, "Электростатика", "Закон Кулона, электрическое поле.", 3, 2, 1, 6),
            (2, "Постоянный ток", "Закон Ома, законы Кирхгофа.", 4, 2, 2, 8),
            (2, "Электромагнетизм", "Магнитное поле, электромагнитная индукция.", 5, 3, 3, 10),
            (2, "Оптика", "Геометрическая и волновая оптика, интерференция.", 5, 3, 3, 10),
            (2, "Квантовая физика", "Фотоэффект, атом Бора, волны де Бройля.", 4, 2, 2, 8),
        ]
        for i, (sem, title, content, lec, prac, lab, srs) in enumerate(phys_sections, 1):
            db.add(RpdSection(id_rpd=rpd3.id_rpd, section_number=i, title=title, brief_content=content,
                              lecture_hours=lec, practice_hours=prac, lab_hours=lab, self_study_hours=srs,
                              semester=sem))

        inf_sections = [
            (1, "Основные понятия теории информации",
             "Цели и задачи информатики. Понятие информации, общая характеристика процессов сбора, передачи, обработки и накопления информации. Свойства информации. Данные. Операции с данными. Кодирование текстовых, числовых, графических данных. Основные структуры: линейные, табличные, иерархические. Системы счисления. Единицы представления, измерения и хранения данных.",
             1, 0, 2, 6),
            (1, "Технические средства реализации информационных процессов",
             "Краткая история развития ЭВМ. Поколения ЭВМ. Классификации компьютеров: по назначению, уровню специализации, типоразмерам, совместимости и др. Базовая конфигурация современного персонального компьютера.",
             2, 0, 2, 8),
            (1, "Программные средства реализации информационных процессов",
             "Программное обеспечение, его уровни. Классификация программного обеспечения. Направления развития и эволюции программных средств. Понятие об операционной системе (ОС). Классификация ОС. Функции ОС. Файлы и файловая структура.",
             2, 0, 2, 8),
            (1, "Разработка программной документации",
             "Работа в текстовом процессоре. Режимы отображения. Создание документа: форматирование текста, проверка правописания, тезаурус, автоформат и автозамена. Вставка рисунков, формул и таблиц. Создание презентаций. Использование шаблонов. Создание электронных таблиц. Типы данных, ввод, редактирование и форматирование. Простейшие вычисления, использование стандартных функций. Построение диаграмм и графиков.",
             1, 0, 2, 8),
            (1, "Алгоритмы и алгоритмизация",
             "Понятие алгоритма. Формы представления алгоритмов. Графический способ представления алгоритмов. Линейные, разветвлённые и циклические алгоритмы. Вложенные и параллельные алгоритмы. Построение алгоритма из базовых структур. Пошаговая детализация как метод проектирования алгоритмов.",
             2, 0, 4, 12),
            (1, "Программные средства реализации алгоритмов",
             "Языки программирования. Алгоритмизация и программирование. Синтаксис и семантика. Трансляция, интерпретация и компиляция программ. Тестирование программ. Программирование алгоритмов.",
             2, 0, 4, 12),
            (1, "Пакеты прикладных программ",
             "Математические, графические пакеты прикладных программ.",
             2, 0, 4, 12),
            (1, "Базы данных",
             "Базы данных (БД) и базы знаний. Назначение БД. Основные понятия реляционных баз данных: поля и записи, свойства полей, типы данных, системы управления БД. Проектирование и обработка БД.",
             2, 0, 4, 8),
            (1, "Телекоммуникации",
             "Локальные и глобальные сети ЭВМ. Сетевые протоколы. Сетевые службы. Основы работы в Интернете. Основные службы Интернета.",
             2, 0, 4, 8),
            (1, "Методы и средства защиты информации",
             "Понятие компьютерной безопасности и защита сведений, составляющих государственную тайну. Компьютерные вирусы: классификация, методы и средства антивирусной защиты. Защита информации в Интернете. Понятие о шифровании. Принцип достаточности защиты. Электронная подпись.",
             2, 0, 4, 8),
            (2, "Технологии программирования",
             "Понятие программного продукта. Жизненный цикл программного обеспечения. Проектирование, программирование, отладка, документирование, сопровождение и эксплуатация программных средств. Стратегии разработки и отладки. Переносимость программ. Экономические, организационные и правовые вопросы создания программного и информационного обеспечения. Понятие интеллектуальной собственности.",
             4, 0, 4, 6),
            (2, "Структурное и объектно-ориентированное программирование",
             "Структурное программирование. Объектно-ориентированное программирование.",
             0, 0, 8, 12),
            (2, "Пакеты и средства обработки информации",
             "Математические, графические пакеты обработки информации. Системы компьютерной математики. Понятие о компьютерной графике. Растровая и векторная графика. Особенности трёхмерного векторного моделирования. Представление графических данных: основные форматы, цветовые модели. Средства создания и обработки графических изображений.",
             2, 0, 6, 10),
            (2, "Современные информационные технологии и их приложения",
             "Краткий обзор существующих информационных технологий. Их возможности и приложения.",
             2, 0, 6, 8),
        ]
        for i, (sem, title, content, lec, prac, lab, srs) in enumerate(inf_sections, 1):
            db.add(RpdSection(id_rpd=rpd4.id_rpd, section_number=i, title=title, brief_content=content,
                              lecture_hours=lec, practice_hours=prac, lab_hours=lab, self_study_hours=srs,
                              semester=sem))
        await db.flush()

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
        for title in lab_topic_titles:
            db.add(RpdTopic(id_rpd=rpd4.id_rpd, topic_type="lab", title=title))

        UCH = "Учебные и научные издания"
        METH = "Методические указания для студентов по освоению дисциплины"
        db.add_all([
            RpdLiterature(id_rpd=rpd2.id_rpd, source_type=UCH, title="Компьютерная графика и геометрическое моделирование (Никулин Е.А., БХВ-Петербург, 2021)"),
            RpdLiterature(id_rpd=rpd2.id_rpd, source_type=UCH, title="Основы компьютерной графики (Шикин Е.В., Боресков А.В., Диалог-МИФИ, 2020)"),
            RpdLiterature(id_rpd=rpd2.id_rpd, source_type=UCH, title="OpenGL. Программирование компьютерной графики (Боресков А.В., Питер, 2019)"),
        ])
        db.add_all([
            RpdLiterature(id_rpd=rpd3.id_rpd, source_type=UCH, title="Курс общей физики. Т. 1-3 (Савельев И.В., Лань, 2020)"),
            RpdLiterature(id_rpd=rpd3.id_rpd, source_type=UCH, title="Курс физики (Трофимова Т.И., Академия, 2019)"),
            RpdLiterature(id_rpd=rpd3.id_rpd, source_type=UCH, title="Задачи по общей физике (Иродов И.Е., Бином, 2021)"),
        ])
        db.add_all([
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type=UCH,
                          title="Информатика. Базовый курс: учебное пособие для втузов. 3-е изд. (Симонович С.В. и др., Питер, 2020)",
                          copies_count=30),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type=UCH,
                          title="Информатика: учебник для вузов. 4-е изд., стер. (Острейковский В.А., Высшая школа, 2007)",
                          copies_count=24),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type=UCH,
                          title="C/C++. Программирование на языке высокого уровня: учебник для вузов (Павловская Т.А., Питер, 2020)",
                          copies_count=50),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type=METH,
                          title="Информатика: учебное пособие (Щапова И.Н., Щапов В.А., Пермь: ПНИПУ, 2016)",
                          copies_count=42),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type=UCH,
                          title="Компьютерные сети. Принципы, технологии, протоколы: учебное пособие для вузов. 4-е изд. (Олифер В.Г., Олифер Н.А., Питер, 2011)",
                          copies_count=46),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type=UCH,
                          title="C/C++. Структурное и объектно-ориентированное программирование: практикум (Павловская Т.А., Щупак Ю.А., Питер, 2011)",
                          copies_count=14),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type=UCH,
                          title="Язык программирования C (Керниган Б.В., 2017)",
                          url="http://www.iprbookshop.ru/73736.html",
                          availability=["IPRsmart"]),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type=UCH,
                          title="Язык программирования C++ для профессионалов (Страуструп Б., 2017)",
                          url="http://www.iprbookshop.ru/73737.html",
                          availability=["IPRsmart"]),
            RpdLiterature(id_rpd=rpd4.id_rpd, source_type=UCH,
                          title="Информатика. Базовый курс: учебное пособие (Денисова Э.В., 2017)",
                          url="http://www.iprbookshop.ru/66475.html",
                          availability=["IPRsmart"]),
        ])

        db.add_all([
            RpdSoftware(id_rpd=rpd4.id_rpd, license_type="Операционные системы", name="Debian (GNU GPL)"),
            RpdSoftware(id_rpd=rpd4.id_rpd, license_type="Операционные системы", name="Windows 10 (Azure Dev Tools for Teaching)"),
            RpdSoftware(id_rpd=rpd4.id_rpd, license_type="Офисные приложения", name="LibreOffice 6.2.4 (OpenSource)"),
            RpdSoftware(id_rpd=rpd4.id_rpd, license_type="Среды разработки", name="Microsoft Visual Studio (Azure Dev Tools for Teaching)"),
            RpdSoftware(id_rpd=rpd4.id_rpd, license_type="Среды разработки", name="MS Visual Studio 2019 Community (Free)"),
            RpdSoftware(id_rpd=rpd4.id_rpd, license_type="СУБД", name="PostgreSQL (PostgreSQL License)"),
        ])

        db.add_all([
            RpdMaterialTech(id_rpd=rpd4.id_rpd, room_type="Лабораторная работа", equipment="Персональный компьютер", quantity=30),
            RpdMaterialTech(id_rpd=rpd4.id_rpd, room_type="Лекция", equipment="Мультимедийный проектор", quantity=1),
        ])

        db.add_all([
            RpdDatabase(id_rpd=rpd4.id_rpd, db_type="Полнотекстовая", name="Elsevier «Freedom Collection»"),
            RpdDatabase(id_rpd=rpd4.id_rpd, db_type="Полнотекстовая", name="Springer Nature e-books"),
            RpdDatabase(id_rpd=rpd4.id_rpd, db_type="Реферативная", name="Научная электронная библиотека (eLIBRARY.RU)"),
            RpdDatabase(id_rpd=rpd4.id_rpd, db_type="ЭБС", name="Научная библиотека ПНИПУ"),
            RpdDatabase(id_rpd=rpd4.id_rpd, db_type="ЭБС", name="ЭБС «Лань»"),
            RpdDatabase(id_rpd=rpd4.id_rpd, db_type="ЭБС", name="ЭБС IPRsmart"),
            RpdDatabase(id_rpd=rpd4.id_rpd, db_type="Информационно-справочная", name="КонсультантПлюс"),
            RpdDatabase(id_rpd=rpd4.id_rpd, db_type="Информационно-справочная", name="Техэксперт: нормы, правила, стандарты и законодательства России"),
        ])

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

        db.add_all([
            RpdSoftware(id_rpd=rpd2.id_rpd, name="Visual Studio Code", license_type="Свободное ПО", purpose="Редактор кода"),
            RpdSoftware(id_rpd=rpd2.id_rpd, name="Blender", license_type="GPL", purpose="3D-моделирование"),
        ])

        db.add_all([
            RpdMaterialTech(id_rpd=rpd3.id_rpd, room_type="Лекционная аудитория", equipment="Проектор, экран, компьютер преподавателя"),
            RpdMaterialTech(id_rpd=rpd3.id_rpd, room_type="Физическая лаборатория", equipment="Лабораторные стенды, измерительные приборы"),
        ])

        db.add_all([
            RpdLearningOutcome(id_rpd=rpd3.id_rpd, id_indicator=ci1.id_indicator,
                               outcome_text="Применяет методы физического анализа при решении инженерных задач",
                               assessment_tool="Экзамен"),
            RpdLearningOutcome(id_rpd=rpd3.id_rpd, id_indicator=ci2.id_indicator,
                               outcome_text="Использует основные законы физики для объяснения процессов в технических системах",
                               assessment_tool="Лабораторная работа"),
        ])

        db.add(RpdDeveloper(id_rpd=rpd2.id_rpd, id_user=teacher.id_user))
        db.add(RpdDeveloper(id_rpd=rpd3.id_rpd, id_user=teacher.id_user))
        db.add(RpdDeveloper(id_rpd=rpd4.id_rpd, id_user=teacher.id_user))

        db.add_all([
            Notification(id_user=teacher.id_user, id_rpd=rpd3.id_rpd, message="РПД Физика отправлена на согласование", is_read=False),
            Notification(id_user=teacher.id_user, id_rpd=rpd4.id_rpd, message="РПД Информатика согласована", is_read=False),
            Notification(id_user=teacher.id_user, id_rpd=rpd2.id_rpd, message="РПД Компьютерная графика возвращена на доработку", is_read=True),
        ])

        await db.commit()
        print("✅ Seed data created successfully")


def _fill_rpd_link_snapshot(link: RpdBupDiscipline, bd: BupDiscipline) -> None:
    bup = bd.bup
    direc = bup.direction if bup else None
    link.bup_name = bup.name if bup else None
    link.bup_year = bup.year if bup else None
    link.bup_profile = bup.profile if bup else None
    link.direction_code = direc.code if direc else None
    link.direction_name = direc.name if direc else None
    link.direction_profile = direc.profile if direc else None
    link.code = bd.code
    link.semester = bd.semester
    link.control_form = bd.control_form
    link.total_hours = bd.total_hours
    link.exam_hours = bd.exam_hours
    link.lecture_hours = bd.lecture_hours
    link.lab_hours = bd.lab_hours
    link.practice_hours = bd.practice_hours
    link.ksr_hours = bd.ksr_hours
    link.self_study_hours = bd.self_study_hours
    link.zet = bd.zet
    link.semesters_data = bd.semesters_data
    link.discipline_name = bd.discipline.name if bd.discipline else None
    link.form_of_study = bup.form_of_study if bup else None


async def seed_test_samples():
    async with async_session() as db:
        marker = await db.execute(select(Rpd).where(Rpd.comment.like("[ТЕСТ]%")))
        if marker.scalars().first():
            return

        teacher_res = await db.execute(select(User).where(User.login == "ivanov"))
        teacher = teacher_res.scalar_one_or_none()
        if teacher is None:
            return

        bup_records: list[Bup] = []
        for fname in SEED_BUP_FILES:
            path = SEED_BUPS_DIR / fname
            if not path.is_file():
                print(f"⚠️  BUP file missing, skip: {path}")
                continue
            try:
                parsed = parse_bup_xls(path.read_bytes())
            except Exception as e:
                print(f"⚠️  Failed to parse {fname}: {e}")
                continue
            try:
                bup = await import_parsed_bup(db, parsed, year=2015, name_override=path.stem)
            except Exception as e:
                print(f"⚠️  Failed to import {fname}: {e}")
                continue
            bup_records.append(bup)
        await db.flush()

        if not bup_records:
            await db.commit()
            return

        res = await db.execute(
            select(Bup)
            .where(Bup.id_bup.in_([b.id_bup for b in bup_records]))
            .options(
                selectinload(Bup.direction),
                selectinload(Bup.disciplines).selectinload(BupDiscipline.discipline),
                selectinload(Bup.disciplines).selectinload(BupDiscipline.bup).selectinload(Bup.direction),
            )
        )
        bups_full = res.scalars().all()

        def sem_count(bd: BupDiscipline) -> int:
            return len(bd.semesters_data or [])

        new_rpds: list[Rpd] = []

        for bup in bups_full:
            single = next((bd for bd in bup.disciplines if sem_count(bd) == 1), None)
            multi = next((bd for bd in bup.disciplines if sem_count(bd) >= 2), None)
            if single:
                rpd = Rpd(
                    id_discipline=single.id_discipline,
                    id_author=teacher.id_user,
                    academic_year="2025/2026",
                    status="Черновик",
                    comment=f"[ТЕСТ] Один семестр · БУП «{bup.name}» · дисциплина «{single.discipline.name}»",
                )
                db.add(rpd)
                await db.flush()
                link = RpdBupDiscipline(id_rpd=rpd.id_rpd, id_bup_discipline=single.id_bup_discipline)
                _fill_rpd_link_snapshot(link, single)
                db.add(link)
                new_rpds.append(rpd)
            if multi:
                rpd = Rpd(
                    id_discipline=multi.id_discipline,
                    id_author=teacher.id_user,
                    academic_year="2025/2026",
                    status="Черновик",
                    comment=f"[ТЕСТ] Несколько семестров · БУП «{bup.name}» · дисциплина «{multi.discipline.name}»",
                )
                db.add(rpd)
                await db.flush()
                link = RpdBupDiscipline(id_rpd=rpd.id_rpd, id_bup_discipline=multi.id_bup_discipline)
                _fill_rpd_link_snapshot(link, multi)
                db.add(link)
                new_rpds.append(rpd)

        disc_to_bds: dict[int, list[BupDiscipline]] = defaultdict(list)
        for bup in bups_full:
            for bd in bup.disciplines:
                disc_to_bds[bd.id_discipline].append(bd)
        cross_bd_list = next((bds for bds in disc_to_bds.values() if len(bds) >= 2), None)
        if cross_bd_list:
            disc_name = cross_bd_list[0].discipline.name
            bup_names = ", ".join(f"«{bd.bup.name}»" for bd in cross_bd_list)
            rpd = Rpd(
                id_discipline=cross_bd_list[0].id_discipline,
                id_author=teacher.id_user,
                academic_year="2025/2026",
                status="Черновик",
                comment=f"[ТЕСТ] Привязка к нескольким БУП-дисциплинам · дисциплина «{disc_name}» · {bup_names}",
            )
            db.add(rpd)
            await db.flush()
            for bd in cross_bd_list:
                link = RpdBupDiscipline(id_rpd=rpd.id_rpd, id_bup_discipline=bd.id_bup_discipline)
                _fill_rpd_link_snapshot(link, bd)
                db.add(link)
            new_rpds.append(rpd)

        manual_disc_one = await _get_or_create_discipline_by_name(db, "Тестовая ручная дисциплина (1 семестр)")
        rpd_manual_one = Rpd(
            id_discipline=manual_disc_one.id_discipline,
            id_author=teacher.id_user,
            academic_year="2025/2026",
            status="Черновик",
            comment="[ТЕСТ] Ручная РПД (без БУПа) · один семестр",
        )
        db.add(rpd_manual_one)
        await db.flush()
        link_one = RpdBupDiscipline(
            id_rpd=rpd_manual_one.id_rpd,
            id_bup_discipline=None,
            is_manual=True,
            discipline_name=manual_disc_one.name,
            semester="3",
            control_form="Экзамен (3)",
            total_hours=144, exam_hours=36,
            lecture_hours=36, lab_hours=18, practice_hours=18, self_study_hours=72, zet=4,
            direction_code="—", direction_name="Без БУПа",
            form_of_study="очная",
            semesters_data=[
                {"number": 3, "lecture": 36, "lab": 18, "practice": 18, "ksr": None, "srs": 72},
            ],
        )
        db.add(link_one)
        new_rpds.append(rpd_manual_one)

        manual_disc_multi = await _get_or_create_discipline_by_name(db, "Тестовая ручная дисциплина (несколько семестров)")
        rpd_manual_multi = Rpd(
            id_discipline=manual_disc_multi.id_discipline,
            id_author=teacher.id_user,
            academic_year="2025/2026",
            status="Черновик",
            comment="[ТЕСТ] Ручная РПД (без БУПа) · несколько семестров",
        )
        db.add(rpd_manual_multi)
        await db.flush()
        link_multi = RpdBupDiscipline(
            id_rpd=rpd_manual_multi.id_rpd,
            id_bup_discipline=None,
            is_manual=True,
            discipline_name=manual_disc_multi.name,
            semester="1, 2",
            control_form="Экзамен (2), Зачёт (1)",
            total_hours=180,
            lecture_hours=36, lab_hours=36, practice_hours=18, self_study_hours=90, zet=5,
            direction_code="—", direction_name="Без БУПа",
            form_of_study="очная",
            semesters_data=[
                {"number": 1, "lecture": 18, "lab": 18, "practice": 9, "ksr": None, "srs": 45},
                {"number": 2, "lecture": 18, "lab": 18, "practice": 9, "ksr": None, "srs": 45},
            ],
        )
        db.add(link_multi)
        new_rpds.append(rpd_manual_multi)

        head_res = await db.execute(select(User).where(User.login == "petrov"))
        head_user = head_res.scalar_one_or_none()
        head_uid = head_user.id_user if head_user else None

        for rpd in new_rpds:
            db.add(RpdDeveloper(id_rpd=rpd.id_rpd, id_user=teacher.id_user))
            if head_uid:
                db.add(RpdApprovalRoute(
                    id_rpd=rpd.id_rpd, step_order=0, id_reviewer=head_uid, status="waiting",
                ))

        await db.commit()
        print(f"✅ Seeded {len(new_rpds)} test RPD samples + {len(bups_full)} BUPs")


async def _get_or_create_discipline_by_name(db, name: str) -> Discipline:
    res = await db.execute(select(Discipline).where(Discipline.name == name))
    d = res.scalars().first()
    if d:
        return d
    d = Discipline(name=name)
    db.add(d)
    await db.flush()
    return d
