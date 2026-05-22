import uuid

import pytest
import pytest_asyncio

from .helpers import get_ok

pytestmark = pytest.mark.asyncio(loop_scope="session")

TECH_UMU_ROLES = {"Преподаватель", "Зав. кафедрой", "Сотрудник УМУ", "Начальник отдела УМУ", "Техник кафедры"}


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def roles(client, auth):
    rows = await get_ok(client, await auth("admin"), "/api/admin/roles")
    return {r["name"]: r["id_role"] for r in rows}


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def depts(client, auth):
    rows = await get_ok(client, await auth("admin"), "/api/admin/departments")
    return {r["name"]: r["id_department"] for r in rows}


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def tech_dept_department(client, auth):
    users = await get_ok(client, await auth("admin"), "/api/admin/users")
    td = next(u for u in users if u["login"] == "tech_dept")
    return td["id_department"]


def _login():
    return "u_" + uuid.uuid4().hex[:10]


async def test_tech_umu_assignable_roles(client, auth):
    rows = await get_ok(client, await auth("tech_umu"), "/api/admin/roles")
    names = {r["name"] for r in rows}
    assert names == TECH_UMU_ROLES


async def test_tech_dept_assignable_roles(client, auth):
    rows = await get_ok(client, await auth("tech_dept"), "/api/admin/roles")
    assert {r["name"] for r in rows} == {"Преподаватель"}


async def test_tech_umu_create_teacher_ok(client, auth, roles, depts):
    h = await auth("tech_umu")
    resp = await client.post("/api/admin/users", headers=h, json={
        "login": _login(), "full_name": "Тест Преподаватель",
        "id_role": roles["Преподаватель"],
        "id_department": depts["Информационных технологий и автоматизированных систем"],
    })
    assert resp.status_code == 201, resp.text


async def test_tech_umu_cannot_create_admin(client, auth, roles, depts):
    h = await auth("tech_umu")
    resp = await client.post("/api/admin/users", headers=h, json={
        "login": _login(), "full_name": "Тест Админ",
        "id_role": roles["Администратор"],
        "id_department": depts["Информационных технологий и автоматизированных систем"],
    })
    assert resp.status_code == 403


async def test_tech_dept_cannot_create_outside_department(client, auth, roles, depts, tech_dept_department):
    h = await auth("tech_dept")
    other_dept = next(v for k, v in depts.items() if v != tech_dept_department)
    resp = await client.post("/api/admin/users", headers=h, json={
        "login": _login(), "full_name": "Чужая кафедра",
        "id_role": roles["Преподаватель"], "id_department": other_dept,
    })
    assert resp.status_code == 403


async def test_tech_dept_create_in_own_department_ok(client, auth, roles, tech_dept_department):
    h = await auth("tech_dept")
    resp = await client.post("/api/admin/users", headers=h, json={
        "login": _login(), "full_name": "Своя кафедра",
        "id_role": roles["Преподаватель"], "id_department": tech_dept_department,
    })
    assert resp.status_code == 201, resp.text


async def test_department_create_and_delete(client, auth):
    h = await auth("admin")
    create = await client.post("/api/admin/departments", headers=h,
                               json={"name": "Тест-кафедра " + uuid.uuid4().hex[:6], "faculty": "ЭТФ"})
    assert create.status_code == 201, create.text
    dept_id = create.json()["id_department"]
    delete = await client.delete(f"/api/admin/departments/{dept_id}", headers=h)
    assert delete.status_code == 204


async def test_delete_department_with_users_blocked(client, auth, depts):
    h = await auth("admin")
    resp = await client.delete(
        f"/api/admin/departments/{depts['Информационных технологий и автоматизированных систем']}",
        headers=h,
    )
    assert resp.status_code == 400


async def test_discipline_crud_and_delete_protection(client, auth):
    h = await auth("admin")
    name = "Тест-дисциплина " + uuid.uuid4().hex[:6]
    create = await client.post("/api/admin/disciplines/", headers=h, json={"name": name})
    assert create.status_code == 201, create.text
    did = create.json()["id_discipline"]

    dup = await client.post("/api/admin/disciplines/", headers=h, json={"name": name})
    assert dup.status_code == 400

    assert (await client.delete(f"/api/admin/disciplines/{did}", headers=h)).status_code == 204

    rows = await get_ok(client, h, "/api/admin/disciplines/", q="Информатика")
    used = next(d for d in rows if d["name"] == "Информатика")
    blocked = await client.delete(f"/api/admin/disciplines/{used['id_discipline']}", headers=h)
    assert blocked.status_code == 400


async def test_admin_bup_crud(client, auth, depts):
    h = await auth("admin")
    directions = await get_ok(client, h, "/api/rpd/directions")
    id_direction = next(d["id_direction"] for d in directions if d["code"] == "09.03.04")

    disc = await client.post("/api/admin/disciplines/", headers=h,
                             json={"name": "БУП-CRUD дисциплина " + uuid.uuid4().hex[:6]})
    id_discipline = disc.json()["id_discipline"]

    bup = await client.post("/api/admin/bups/", headers=h,
                            json={"id_direction": id_direction, "name": "CRUD БУП " + uuid.uuid4().hex[:6], "year": 2031})
    assert bup.status_code == 201, bup.text
    bup_id = bup.json()["id_bup"]

    add = await client.post(f"/api/admin/bups/{bup_id}/disciplines", headers=h, json={
        "id_discipline": id_discipline, "code": "Б1.О.99", "semester": "1",
        "control_form": "Зачёт (1)", "total_hours": 72, "lecture_hours": 18,
        "lab_hours": 18, "self_study_hours": 36, "zet": 2,
    })
    assert add.status_code == 201, add.text

    detail = await get_ok(client, h, f"/api/admin/bups/{bup_id}")
    assert len(detail["disciplines"]) == 1

    assert (await client.delete(f"/api/admin/bups/{bup_id}", headers=h)).status_code == 204
