import pytest

from .helpers import get_ok

pytestmark = pytest.mark.asyncio(loop_scope="session")

ROLE_BY_LOGIN = {
    "ivanov": "Преподаватель",
    "kozlova": "Преподаватель",
    "petrov": "Зав. кафедрой",
    "solovieva": "Начальник отдела УМУ",
    "kuznetsov": "Начальник управления УМУ",
    "orlov": "Проректор",
    "rector": "Ректор",
    "tech_umu": "Техник УМУ",
    "tech_dept": "Техник кафедры",
    "admin": "Администратор",
}

EXPECTED_PERMS = {
    "Преподаватель": set(),
    "Зав. кафедрой": {"rpd.approve"},
    "Сотрудник УМУ": {"rpd.create", "sources.manage"},
    "Начальник отдела УМУ": {"rpd.create", "rpd.approve", "rpd.edit_meta", "approval_chain.edit", "sources.manage"},
    "Начальник управления УМУ": {"rpd.create", "rpd.approve", "rpd.edit_meta", "approval_chain.edit", "sources.manage"},
    "Проректор": {"rpd.approve"},
    "Ректор": {"rpd.approve"},
    "Техник УМУ": {"rpd.create", "rpd.edit_meta", "approval_chain.edit", "rpd.delete_any", "users.create", "sources.manage"},
    "Техник кафедры": {"rpd.create", "rpd.edit_meta", "approval_chain.edit", "users.create", "sources.manage"},
    "Администратор": {"*"},
}


@pytest.mark.parametrize("login_name", list(ROLE_BY_LOGIN))
async def test_role_permission_sets(client, auth, login_name):
    me = await get_ok(client, await auth(login_name), "/api/auth/me")
    role = ROLE_BY_LOGIN[login_name]
    assert me["role"] == role
    assert set(me["permissions"]) == EXPECTED_PERMS[role]


async def test_teacher_cannot_create_rpd(client, auth):
    resp = await client.post("/api/rpd/", headers=await auth("ivanov"),
                             json={"academic_year": "2025/2026", "id_discipline": 1})
    assert resp.status_code == 403


async def test_teacher_cannot_open_admin_users(client, auth):
    resp = await client.get("/api/admin/users", headers=await auth("ivanov"))
    assert resp.status_code == 403


async def test_teacher_cannot_open_admin_bups(client, auth):
    resp = await client.get("/api/admin/bups/", headers=await auth("ivanov"))
    assert resp.status_code == 403


async def test_head_cannot_manage_sources(client, auth):
    resp = await client.get("/api/admin/bups/", headers=await auth("petrov"))
    assert resp.status_code == 403


async def test_umu_chief_manages_sources_not_users(client, auth):
    h = await auth("solovieva")
    assert (await client.get("/api/admin/bups/", headers=h)).status_code == 200
    assert (await client.get("/api/admin/users", headers=h)).status_code == 403


async def test_admin_sees_admin_endpoints(client, auth):
    h = await auth("admin")
    assert (await client.get("/api/admin/users", headers=h)).status_code == 200
    assert (await client.get("/api/admin/disciplines/", headers=h)).status_code == 200


async def test_reviewers_list_excludes_wildcard_admin(client, auth):
    rows = await get_ok(client, await auth("ivanov"), "/api/rpd/reviewers")
    names = {r["full_name"] for r in rows}
    assert "Петров Пётр Петрович" in names
    assert "Сидоров Алексей Михайлович" not in names
    for r in rows:
        assert r["role"] != "Администратор"
