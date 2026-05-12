from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text

from app.core.database import engine, Base
from app.routers import (
    auth, rpd, llm, notifications, competencies, upload, export,
    admin, bups, admin_bups, reference, files, admin_directions, fos,
    suggestions, admin_dictionary, admin_disciplines, admin_documents,
    admin_llm_prompts,
)
from app.seed import seed_data

async def _apply_schema_patches() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE rpd DROP COLUMN IF EXISTS deleted_bup_names"))
        await conn.execute(text("ALTER TABLE bups DROP COLUMN IF EXISTS deleted_at"))

        await conn.execute(text(
            "ALTER TABLE rpd_bup_disciplines ALTER COLUMN id_bup_discipline DROP NOT NULL"
        ))
        for col, ddl in [
            ("bup_name", "VARCHAR(300)"),
            ("bup_year", "INTEGER"),
            ("bup_profile", "VARCHAR(200)"),
            ("direction_code", "VARCHAR(20)"),
            ("direction_name", "VARCHAR(200)"),
            ("direction_profile", "VARCHAR(200)"),
            ("fgos_file_id", "INTEGER"),
            ("fgos_file_name", "VARCHAR(300)"),
            ("code", "VARCHAR(30)"),
            ("semester", "VARCHAR(30)"),
            ("control_form", "VARCHAR(255)"),
            ("total_hours", "INTEGER"),
            ("lecture_hours", "INTEGER"),
            ("lab_hours", "INTEGER"),
            ("practice_hours", "INTEGER"),
            ("ksr_hours", "INTEGER"),
            ("self_study_hours", "INTEGER"),
            ("zet", "INTEGER"),
            ("discipline_name", "VARCHAR(200)"),
        ]:
            await conn.execute(text(
                f"ALTER TABLE rpd_bup_disciplines ADD COLUMN IF NOT EXISTS {col} {ddl}"
            ))

        await conn.execute(text(
            "ALTER TABLE rpd_learning_outcomes ALTER COLUMN id_indicator DROP NOT NULL"
        ))
        for col, ddl in [
            ("indicator_code", "VARCHAR(20)"),
            ("indicator_description", "TEXT"),
            ("competency_code", "VARCHAR(20)"),
            ("competency_name", "TEXT"),
        ]:
            await conn.execute(text(
                f"ALTER TABLE rpd_learning_outcomes ADD COLUMN IF NOT EXISTS {col} {ddl}"
            ))

        await conn.execute(text("ALTER TABLE competency_indicators ALTER COLUMN code TYPE VARCHAR(40)"))
        await conn.execute(text("ALTER TABLE uploaded_documents ALTER COLUMN id_rpd DROP NOT NULL"))

        await conn.execute(text(r"""
            UPDATE competency_indicators ci
            SET code = 'ИД-' || split_part(ci.code, '.', 2) || c.code
            FROM competencies c
            WHERE ci.id_competency = c.id_competency
              AND ci.code LIKE c.code || '.%'
              AND ci.code ~ '^.+\.[0-9]+$'
        """))
        await conn.execute(text(
            "DELETE FROM dictionary_entries WHERE kind IN ('indicator_code', 'indicator_description')"
        ))

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _apply_schema_patches()
    await seed_data()
    from app.core.database import async_session
    from app.services.dictionary_service import backfill_from_approved
    from app.services.document_sections import backfill_unprocessed_documents
    async with async_session() as db:
        await backfill_from_approved(db)
        try:
            processed = await backfill_unprocessed_documents(db)
            if processed:
                print(f"✅ Documents sectioned at startup ({processed} files)")
        except Exception as e:
            print(f"⚠️ Document section backfill failed: {e}")
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

app.include_router(auth.router)
app.include_router(rpd.router)
app.include_router(bups.router)
app.include_router(competencies.router)
app.include_router(llm.router)
app.include_router(upload.router)
app.include_router(export.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(admin_bups.router)
app.include_router(admin_directions.router)
app.include_router(reference.router)
app.include_router(suggestions.router)
app.include_router(admin_dictionary.router)
app.include_router(admin_disciplines.router)
app.include_router(admin_documents.router)
app.include_router(admin_llm_prompts.router)
app.include_router(files.router)
app.include_router(fos.router)

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ИС РПД", "version": "1.0.0"}
