import os
import tempfile
from urllib.parse import urlsplit, urlunsplit

import pytest
import pytest_asyncio

BASE_DB_URL = os.environ.get(
    "TEST_BASE_DATABASE_URL",
    "postgresql+asyncpg://rpd_user:rpd_secret@db:5432/rpd_db",
)
TEST_DB_NAME = os.environ.get("TEST_DB_NAME", "rpd_test")


def _swap_db_name(url: str, new_name: str) -> str:
    parts = urlsplit(url)
    return urlunsplit(parts._replace(path="/" + new_name))


TEST_DB_URL = _swap_db_name(BASE_DB_URL, TEST_DB_NAME)
ADMIN_DB_URL = _swap_db_name(BASE_DB_URL, "postgres")

os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["LLM_API_KEY"] = "demo"
os.environ["STORAGE_BACKEND"] = "local"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="rpd_test_uploads_")
os.environ.setdefault("SECRET_KEY", "test-secret-key")


def _asyncpg_dsn(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://")


async def _recreate_test_database() -> None:
    import asyncpg

    conn = await asyncpg.connect(_asyncpg_dsn(ADMIN_DB_URL))
    try:
        await conn.execute(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            "WHERE datname = $1 AND pid <> pg_backend_pid()",
            TEST_DB_NAME,
        )
        await conn.execute(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}"')
        await conn.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')
    finally:
        await conn.close()


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def client():
    from asgi_lifespan import LifespanManager
    from httpx import ASGITransport, AsyncClient

    await _recreate_test_database()

    from app.main import app

    async with LifespanManager(app, startup_timeout=120, shutdown_timeout=60):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
            yield ac


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def login(client):
    cache: dict[str, str] = {}

    async def _login(username: str, password: str = "password") -> str:
        if username in cache:
            return cache[username]
        resp = await client.post(
            "/api/auth/login",
            data={"username": username, "password": password},
        )
        assert resp.status_code == 200, f"login {username} failed: {resp.text}"
        token = resp.json()["access_token"]
        cache[username] = token
        return token

    return _login


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def auth(login):
    async def _auth(username: str) -> dict:
        token = await login(username)
        return {"Authorization": f"Bearer {token}"}

    return _auth
