"""FastAPI application bootstrap.

Keeps things tiny: schema creation + seed (on startup), CORS, router wiring,
health endpoint. The demo seed itself lives in `app/seed.py`.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.routers import auth, rpd, llm, notifications, competencies, upload, export, admin, bups
from app.seed import seed_data


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

app.include_router(auth.router)
app.include_router(rpd.router)
app.include_router(bups.router)
app.include_router(competencies.router)
app.include_router(llm.router)
app.include_router(upload.router)
app.include_router(export.router)
app.include_router(notifications.router)
app.include_router(admin.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ИС РПД", "version": "1.0.0"}
