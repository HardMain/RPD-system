import pytest
import pytest_asyncio

from .helpers import get_ok, rpd_detail

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _make_manual_draft(client, headers, name):
    resp = await client.post("/api/rpd/", headers=headers, json={
        "academic_year": "2099/2100",
        "manual": {
            "discipline_name": name,
            "direction_code": "—", "direction_name": "Без БУПа", "form_of_study": "очная",
            "semester": "1, 2", "control_form": "Экзамен (2)",
            "zet": 5, "lecture_hours": 36, "lab_hours": 36, "practice_hours": 0, "self_study_hours": 90,
            "semesters_data": [
                {"number": 1, "lecture": 18, "lab": 18, "practice": 0, "ksr": None, "srs": 45},
                {"number": 2, "lecture": 18, "lab": 18, "practice": 0, "ksr": None, "srs": 45},
            ],
        },
    })
    assert resp.status_code == 201, resp.text
    return resp.json()["id_rpd"]


@pytest_asyncio.fixture
async def draft(client, auth):
    import uuid
    h = await auth("tech_umu")
    rid = await _make_manual_draft(client, h, f"Редактируемая дисц {uuid.uuid4().hex[:8]}")
    return {"id": rid, "h": h}


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def indicator_id(client, auth):
    h = await auth("tech_umu")
    dirs = await get_ok(client, h, "/api/rpd/directions")
    dir_pi = next(d for d in dirs if d["code"] == "09.03.04")
    comps = await get_ok(client, h, "/api/competencies/", direction_id=dir_pi["id_direction"])
    for c in comps:
        if c["indicators"]:
            return c["indicators"][0]["id_indicator"]
    raise AssertionError("нет индикаторов")


async def test_patch_text_fields(client, draft):
    rid, h = draft["id"], draft["h"]
    resp = await client.patch(f"/api/rpd/{rid}", headers=h, json={
        "goals_text": "Цель — проверить автосейв.",
        "objects_text": "Объекты дисциплины.",
        "requirements_text": "Пререквизиты.",
        "educational_tech": "Технологии.",
        "methodical_recommendations": "Рекомендации.",
        "comment": "комментарий",
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["goals_text"] == "Цель — проверить автосейв."
    assert body["comment"] == "комментарий"


async def test_sections_crud_with_semester(client, draft):
    rid, h = draft["id"], draft["h"]
    s1 = await client.post(f"/api/rpd/{rid}/sections", headers=h, json={
        "section_number": 1, "title": "Раздел сем 1", "brief_content": "о",
        "lecture_hours": 4, "practice_hours": 0, "lab_hours": 2, "self_study_hours": 10, "semester": 1,
    })
    assert s1.status_code == 201, s1.text
    sid = s1.json()["id_section"]
    assert s1.json()["semester"] == 1

    s2 = await client.post(f"/api/rpd/{rid}/sections", headers=h, json={
        "section_number": 2, "title": "Раздел сем 2", "lecture_hours": 6,
        "practice_hours": 0, "lab_hours": 4, "self_study_hours": 12, "semester": 2,
    })
    assert s2.status_code == 201

    upd = await client.put(f"/api/rpd/sections/{sid}", headers=h, json={
        "section_number": 1, "title": "Раздел сем 1 (изм)", "brief_content": "обновлено",
        "lecture_hours": 5, "practice_hours": 0, "lab_hours": 2, "self_study_hours": 10, "semester": 1,
    })
    assert upd.status_code == 200
    assert upd.json()["title"] == "Раздел сем 1 (изм)"

    detail = await rpd_detail(client, h, rid)
    sems = sorted(s["semester"] for s in detail["sections"])
    assert sems == [1, 2]

    d = await client.delete(f"/api/rpd/sections/{sid}", headers=h)
    assert d.status_code == 204
    detail = await rpd_detail(client, h, rid)
    assert len(detail["sections"]) == 1


async def test_topics_crud(client, draft):
    rid, h = draft["id"], draft["h"]
    t = await client.post(f"/api/rpd/{rid}/topics", headers=h, json={
        "topic_type": "lab", "title": "ЛР 1", "hours": 4, "description": "опис",
    })
    assert t.status_code == 201, t.text
    tid = t.json()["id_topic"]
    upd = await client.put(f"/api/rpd/topics/{tid}", headers=h, json={"title": "ЛР 1 (изм)"})
    assert upd.status_code == 200
    assert upd.json()["title"] == "ЛР 1 (изм)"
    assert (await client.delete(f"/api/rpd/topics/{tid}", headers=h)).status_code == 204


async def test_literature_crud(client, draft):
    rid, h = draft["id"], draft["h"]
    lit = await client.post(f"/api/rpd/{rid}/literature", headers=h, json={
        "source_type": "Учебные и научные издания", "title": "Книга про тесты", "copies_count": 10,
    })
    assert lit.status_code == 201, lit.text
    lid = lit.json()["id_literature"]
    upd = await client.put(f"/api/rpd/literature/{lid}", headers=h, json={"copies_count": 25})
    assert upd.status_code == 200
    assert upd.json()["copies_count"] == 25
    assert (await client.delete(f"/api/rpd/literature/{lid}", headers=h)).status_code == 204


async def test_software_database_mtech_crud(client, draft):
    rid, h = draft["id"], draft["h"]
    sw = await client.post(f"/api/rpd/{rid}/software", headers=h,
                           json={"name": "VS Code", "license_type": "Среды разработки, тестирования и отладки"})
    assert sw.status_code == 201, sw.text
    assert (await client.delete(f"/api/rpd/software/{sw.json()['id_software']}", headers=h)).status_code == 204

    db = await client.post(f"/api/rpd/{rid}/databases", headers=h,
                           json={"name": "eLIBRARY", "url": "https://elibrary.ru/"})
    assert db.status_code == 201, db.text
    assert (await client.delete(f"/api/rpd/databases/{db.json()['id_database']}", headers=h)).status_code == 204

    mt = await client.post(f"/api/rpd/{rid}/material-tech", headers=h,
                           json={"room_type": "Лекция", "equipment": "Проектор", "quantity": 1})
    assert mt.status_code == 201, mt.text
    assert (await client.delete(f"/api/rpd/material-tech/{mt.json()['id_material_tech']}", headers=h)).status_code == 204


async def test_outcomes_add_and_upsert(client, draft, indicator_id):
    rid, h = draft["id"], draft["h"]
    add = await client.post(f"/api/rpd/{rid}/outcomes", headers=h, json={
        "id_indicator": indicator_id, "outcome_text": "Знает основы", "assessment_tool": "Экзамен",
    })
    assert add.status_code == 201, add.text
    oid = add.json()["id_outcome"]
    assert add.json()["indicator_code"]

    ups = await client.post(f"/api/rpd/{rid}/outcomes/upsert", headers=h, json={
        "id_outcome": oid, "outcome_text": "Знает основы (изм)", "assessment_tool": "Зачёт",
    })
    assert ups.status_code == 200, ups.text
    assert ups.json()["outcome_text"] == "Знает основы (изм)"

    assert (await client.delete(f"/api/rpd/outcomes/{oid}", headers=h)).status_code == 204


async def test_manual_outcome_dedup(client, draft, indicator_id):
    rid, h = draft["id"], draft["h"]
    first = await client.post(f"/api/rpd/{rid}/outcomes/manual", headers=h, json={
        "id_indicator": indicator_id, "outcome_text": "Знает", "assessment_tool": "Экзамен",
    })
    assert first.status_code == 201, first.text
    dup = await client.post(f"/api/rpd/{rid}/outcomes/manual", headers=h, json={
        "id_indicator": indicator_id, "outcome_text": "ещё раз",
    })
    assert dup.status_code == 400
    assert "уже добавлена" in dup.json()["detail"]


async def test_developers_add_remove(client, draft, auth):
    rid, h = draft["id"], draft["h"]
    kozlova = await get_ok(client, await auth("kozlova"), "/api/auth/me")
    add = await client.post(f"/api/rpd/{rid}/developers", headers=h, params={"user_id": kozlova["id_user"]})
    assert add.status_code == 201, add.text
    dev_id = add.json()["id_rpd_developer"]
    assert add.json()["full_name"] == "Козлова Мария Сергеевна"
    assert (await client.delete(f"/api/rpd/developers/{dev_id}", headers=h)).status_code == 204


async def test_manual_link_recompute_hours(client, draft):
    rid, h = draft["id"], draft["h"]
    resp = await client.patch(f"/api/rpd/{rid}/manual-link", headers=h, json={
        "zet": 6,
        "semesters_data": [
            {"number": 1, "lecture": 20, "lab": 20, "practice": 0, "ksr": None, "srs": 40},
            {"number": 2, "lecture": 16, "lab": 16, "practice": 0, "ksr": None, "srs": 50},
        ],
    })
    assert resp.status_code == 200, resp.text
    link = resp.json()["bup_disciplines"][0]
    assert link["total_hours"] == 6 * 36
    assert link["lecture_hours"] == 36
    assert link["self_study_hours"] == 90
    assert link["semester"] == "1, 2"


async def test_delete_draft(client, draft):
    rid, h = draft["id"], draft["h"]
    assert (await client.delete(f"/api/rpd/{rid}", headers=h)).status_code == 204
    assert (await client.get(f"/api/rpd/{rid}", headers=h)).status_code == 404
