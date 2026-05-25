import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.migrations import run_migrations
from app.routers import (
    auth, rpd, llm, notifications, competencies, upload, export,
    admin, bups, admin_bups, reference, files, admin_directions, fos,
    suggestions, admin_dictionary, admin_disciplines, admin_documents,
    admin_llm_prompts, admin_system, admin_fos,
)
from app.seed import seed_data

@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(run_migrations)
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
app.include_router(admin_system.router)
app.include_router(admin_fos.router)
app.include_router(files.router)
app.include_router(fos.router)

@app.get("/api/health")
async def health():
    from app.core.config import settings
    from app.services.app_settings import get_llm_model
    llm_demo = settings.LLM_API_KEY.strip().lower() == "demo"
    model = await get_llm_model()
    return {
        "status": "ok",
        "service": "ИС РПД",
        "version": "1.0.0",
        "llm": {
            "mode": "demo" if llm_demo else "online",
            "model": model,
        },
    }
