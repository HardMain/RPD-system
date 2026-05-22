import pytest
import pytest_asyncio

from .helpers import get_ok, find_rpd, rpd_detail, bd_id_for, my_id

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def petrov_id(client, auth):
    return await my_id(client, await auth("petrov"))


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def ivanov_id(client, auth):
    return await my_id(client, await auth("ivanov"))


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def multibup(client, auth):
    """Два БУПа одного направления с одинаковой дисциплиной — для multi-БУП-сценариев."""
    h = await auth("tech_umu")
    directions = await get_ok(client, h, "/api/rpd/directions")
    dir_pi = next(d for d in directions if d["code"] == "09.03.04")
    id_direction = dir_pi["id_direction"]

    comps = await get_ok(client, h, "/api/competencies/", direction_id=id_direction)
    comp_ids = [c["id_competency"] for c in comps[:2]]
    assert comp_ids, "нет компетенций у направления 09.03.04"

    disc = await client.post("/api/admin/disciplines/", headers=h,
                             json={"name": "Мультибуп тест-дисциплина"})
    assert disc.status_code == 201, disc.text
    id_discipline = disc.json()["id_discipline"]

    hours = dict(code="Т-1", semester="3", control_form="Экзамен (3)",
                 total_hours=144, lecture_hours=36, lab_hours=18, practice_hours=18,
                 ksr_hours=None, self_study_hours=72, zet=4)

    async def make_bup(name):
        b = await client.post("/api/admin/bups/", headers=h,
                              json={"id_direction": id_direction, "name": name, "year": 2030})
        assert b.status_code == 201, b.text
        return b.json()["id_bup"]

    async def add_disc(bup_id, **overrides):
        payload = {"id_discipline": id_discipline, **hours, "competency_ids": comp_ids}
        payload.update(overrides)
        r = await client.post(f"/api/admin/bups/{bup_id}/disciplines", headers=h, json=payload)
        assert r.status_code == 201, r.text
        return r.json()["id_bup_discipline"]

    bup_a = await make_bup("ТЕСТ БУП A 2030")
    bup_b = await make_bup("ТЕСТ БУП B 2030")
    bd_a = await add_disc(bup_a)
    bd_b = await add_disc(bup_b)
    bd_mismatch = await add_disc(bup_b, code="Т-1м", total_hours=180, self_study_hours=108)
    return {"bd_a": bd_a, "bd_b": bd_b, "bd_mismatch": bd_mismatch,
            "id_discipline": id_discipline, "id_direction": id_direction}


async def test_create_from_single_bup(client, auth, petrov_id):
    h = await auth("tech_umu")
    bd = await bd_id_for(client, h, "Физика")
    resp = await client.post("/api/rpd/", headers=h, json={
        "bup_discipline_ids": [bd],
        "academic_year": "2099/2100",
        "reviewer_ids": [petrov_id],
    })
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "Черновик"
    assert body["academic_year"] == "2099/2100"
    assert len(body["bup_disciplines"]) == 1
    assert body["bup_disciplines"][0]["id_bup_discipline"] == bd
    assert len(body["learning_outcomes"]) > 0, "результаты обучения должны автозаполниться"
    assert len(body["approval_route"]) == 1
    assert body["approval_route"][0]["status"] == "waiting"


async def test_create_rejects_two_disciplines(client, auth):
    h = await auth("tech_umu")
    bd_db = await bd_id_for(client, h, "Физика")
    bd_kg = await bd_id_for(client, h, "Компьютерная графика")
    resp = await client.post("/api/rpd/", headers=h, json={
        "bup_discipline_ids": [bd_db, bd_kg],
        "academic_year": "2099/2100",
    })
    assert resp.status_code == 400
    assert "логической дисциплине" in resp.json()["detail"]


async def test_create_multibup_matching(client, auth, multibup):
    h = await auth("tech_umu")
    resp = await client.post("/api/rpd/", headers=h, json={
        "bup_discipline_ids": [multibup["bd_a"], multibup["bd_b"]],
        "academic_year": "2099/2100",
    })
    assert resp.status_code == 201, resp.text
    body = resp.json()
    bd_ids = {l["id_bup_discipline"] for l in body["bup_disciplines"]}
    assert {multibup["bd_a"], multibup["bd_b"]} <= bd_ids
    assert len(body["learning_outcomes"]) > 0


async def test_create_multibup_mismatched_hours(client, auth, multibup):
    h = await auth("tech_umu")
    resp = await client.post("/api/rpd/", headers=h, json={
        "bup_discipline_ids": [multibup["bd_a"], multibup["bd_mismatch"]],
        "academic_year": "2099/2100",
    })
    assert resp.status_code == 400
    assert "различается" in resp.json()["detail"]


async def test_create_manual_one_semester(client, auth):
    h = await auth("tech_umu")
    resp = await client.post("/api/rpd/", headers=h, json={
        "academic_year": "2099/2100",
        "manual": {
            "discipline_name": "Ручная тест-дисциплина (1 сем)",
            "direction_code": "—", "direction_name": "Без БУПа", "form_of_study": "очная",
            "semester": "3", "control_form": "Экзамен (3)",
            "zet": 4, "lecture_hours": 36, "lab_hours": 18, "practice_hours": 18, "self_study_hours": 72,
            "semesters_data": [{"number": 3, "lecture": 36, "lab": 18, "practice": 18, "ksr": None, "srs": 72}],
        },
    })
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert len(body["bup_disciplines"]) == 1
    link = body["bup_disciplines"][0]
    assert link["is_manual"] is True
    assert link["total_hours"] == 4 * 36


async def test_create_manual_multi_semester(client, auth):
    h = await auth("tech_umu")
    resp = await client.post("/api/rpd/", headers=h, json={
        "academic_year": "2099/2100",
        "manual": {
            "discipline_name": "Ручная тест-дисциплина (2 сем)",
            "direction_code": "—", "direction_name": "Без БУПа", "form_of_study": "очная",
            "semester": "1, 2", "control_form": "Экзамен (2), Зачёт (1)",
            "zet": 5, "lecture_hours": 36, "lab_hours": 36, "practice_hours": 18, "self_study_hours": 90,
            "semesters_data": [
                {"number": 1, "lecture": 18, "lab": 18, "practice": 9, "ksr": None, "srs": 45},
                {"number": 2, "lecture": 18, "lab": 18, "practice": 9, "ksr": None, "srs": 45},
            ],
        },
    })
    assert resp.status_code == 201, resp.text
    link = resp.json()["bup_disciplines"][0]
    assert link["is_manual"] is True
    assert link["semesters_data"] and len(link["semesters_data"]) == 2


async def test_create_clone_from_archive(client, auth):
    h = await auth("tech_umu")
    base = await find_rpd(client, h, discipline="Информатика", status="Согласовано")
    assert base, "нет согласованной РПД-образца Информатика"
    base_detail = await rpd_detail(client, h, base["id_rpd"])
    resp = await client.post("/api/rpd/", headers=h, json={
        "id_discipline": base_detail["id_discipline"],
        "academic_year": "2099/2100",
        "based_on_rpd_id": base["id_rpd"],
    })
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "Черновик"
    assert body["goals_text"] == base_detail["goals_text"]
    assert len(body["sections"]) == len(base_detail["sections"])
    assert len(body["learning_outcomes"]) == len(base_detail["learning_outcomes"])


async def test_create_rejects_reviewer_without_approve(client, auth, ivanov_id):
    h = await auth("tech_umu")
    bd = await bd_id_for(client, h, "Физика")
    resp = await client.post("/api/rpd/", headers=h, json={
        "bup_discipline_ids": [bd],
        "academic_year": "2099/2100",
        "reviewer_ids": [ivanov_id],
    })
    assert resp.status_code == 400
    assert "права согласования" in resp.json()["detail"]


async def test_create_rejects_duplicate_reviewers(client, auth, petrov_id):
    h = await auth("tech_umu")
    bd = await bd_id_for(client, h, "Физика")
    resp = await client.post("/api/rpd/", headers=h, json={
        "bup_discipline_ids": [bd],
        "academic_year": "2099/2100",
        "reviewer_ids": [petrov_id, petrov_id],
    })
    assert resp.status_code == 400
    assert "повторяться" in resp.json()["detail"]


async def test_seeded_test_samples_present(client, auth):
    """seed_test_samples создаёт помеченные [ТЕСТ] РПД всех конфигураций."""
    h = await auth("ivanov")
    rows = await get_ok(client, h, "/api/rpd/")
    comments = [r.get("comment") or "" for r in rows]
    assert any("[ТЕСТ]" in c and "Ручная" in c for c in comments)
