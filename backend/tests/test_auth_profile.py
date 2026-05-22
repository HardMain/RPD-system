import pytest

from .helpers import get_ok

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_login_success_returns_token_and_profile(client):
    resp = await client.post("/api/auth/login", data={"username": "ivanov", "password": "password"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["access_token"]
    assert body["user"]["full_name"] == "Иванов Иван Иванович"
    assert body["user"]["role"] == "Преподаватель"
    assert "permissions" in body["user"]


async def test_login_wrong_password(client):
    resp = await client.post("/api/auth/login", data={"username": "ivanov", "password": "wrong"})
    assert resp.status_code == 401


async def test_login_unknown_user(client):
    resp = await client.post("/api/auth/login", data={"username": "nobody", "password": "password"})
    assert resp.status_code == 401


async def test_me_requires_token(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_me_with_token(client, auth):
    me = await get_ok(client, await auth("petrov"), "/api/auth/me")
    assert me["role"] == "Зав. кафедрой"
    assert me["title"]


async def test_invalid_token_rejected(client):
    resp = await client.get("/api/auth/me", headers={"Authorization": "Bearer garbage.token.value"})
    assert resp.status_code == 401


async def test_update_profile_email_and_theme(client, auth):
    h = await auth("orlov")
    resp = await client.patch("/api/auth/me", headers=h, json={"email": "orlov2@pstu.ru", "theme": "dark"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == "orlov2@pstu.ru"
    assert body["theme"] == "dark"
    await client.patch("/api/auth/me", headers=h, json={"theme": "light"})


async def test_update_profile_bad_email(client, auth):
    resp = await client.patch("/api/auth/me", headers=await auth("orlov"), json={"email": "no-at-sign"})
    assert resp.status_code == 400


async def test_update_profile_bad_theme(client, auth):
    resp = await client.patch("/api/auth/me", headers=await auth("orlov"), json={"theme": "neon"})
    assert resp.status_code == 400


async def test_change_password_flow(client, auth, login):
    h = await auth("kuznetsov")
    bad = await client.post("/api/auth/change-password", headers=h,
                            json={"old_password": "nope", "new_password": "newpass123"})
    assert bad.status_code == 400

    short = await client.post("/api/auth/change-password", headers=h,
                              json={"old_password": "password", "new_password": "ab"})
    assert short.status_code == 400

    same = await client.post("/api/auth/change-password", headers=h,
                             json={"old_password": "password", "new_password": "password"})
    assert same.status_code == 400

    ok = await client.post("/api/auth/change-password", headers=h,
                           json={"old_password": "password", "new_password": "newpass123"})
    assert ok.status_code == 204

    fresh = await client.post("/api/auth/login", data={"username": "kuznetsov", "password": "newpass123"})
    assert fresh.status_code == 200

    restore = await client.post("/api/auth/change-password", headers=h,
                                json={"old_password": "newpass123", "new_password": "password"})
    assert restore.status_code == 204
