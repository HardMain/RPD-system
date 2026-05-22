import pytest

from .helpers import get_ok

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_software_suggestions_scoped_by_type(client, auth):
    h = await auth("tech_umu")
    os_items = (await get_ok(client, h, "/api/suggestions/software_name",
                             source_type="Операционные системы"))["items"]
    assert any("Debian" in x for x in os_items)
    assert not any("Photoshop" in x for x in os_items)

    img_items = (await get_ok(client, h, "/api/suggestions/software_name",
                              source_type="ПО для обработки изображений"))["items"]
    assert any(("Photoshop" in x) or ("GIMP" in x) for x in img_items)
    assert not any("Debian" in x for x in img_items)


async def test_software_suggestions_global_without_type(client, auth):
    h = await auth("tech_umu")
    items = (await get_ok(client, h, "/api/suggestions/software_name"))["items"]
    assert any("Debian" in x for x in items)
    assert any("Photoshop" in x for x in items)


async def test_database_suggestions_global(client, auth):
    h = await auth("tech_umu")
    items = (await get_ok(client, h, "/api/suggestions/database_name"))["items"]
    assert any(("eLIBRARY" in x) or ("Лань" in x) for x in items)


async def test_admin_software_requires_type_no_discipline(client, auth):
    h = await auth("tech_umu")
    bad = await client.post("/api/admin/dictionary/software_name", headers=h,
                            json={"value": "TestSoft БезВида"})
    assert bad.status_code == 400
    assert "вид ПО" in bad.json()["detail"]

    ok = await client.post("/api/admin/dictionary/software_name", headers=h,
                           json={"value": "TestSoft Типизированный", "source_type": "Операционные системы"})
    assert ok.status_code == 201
    assert ok.json()["source_type"] == "Операционные системы"
    assert ok.json()["id_discipline"] is None

    items = (await get_ok(client, h, "/api/suggestions/software_name",
                          source_type="Операционные системы"))["items"]
    assert any("TestSoft Типизированный" in x for x in items)


async def test_admin_software_rejects_unknown_type(client, auth):
    h = await auth("tech_umu")
    resp = await client.post("/api/admin/dictionary/software_name", headers=h,
                             json={"value": "TestSoft Чужой", "source_type": "Выдуманный вид"})
    assert resp.status_code == 400


async def test_admin_database_no_discipline_needed(client, auth):
    h = await auth("tech_umu")
    ok = await client.post("/api/admin/dictionary/database_name", headers=h,
                           json={"value": "Тестовая БД глобальная", "extra": "https://глобальная.example/"})
    assert ok.status_code == 201
    assert ok.json()["id_discipline"] is None


async def test_admin_database_requires_url(client, auth):
    h = await auth("tech_umu")
    resp = await client.post("/api/admin/dictionary/database_name", headers=h,
                             json={"value": "БД без ссылки"})
    assert resp.status_code == 400
    assert "ссылк" in resp.json()["detail"].lower()


async def test_database_refs_carry_urls(client, auth):
    h = await auth("tech_umu")
    refs = (await get_ok(client, h, "/api/suggestions/database_name/refs"))["items"]
    elib = next((r for r in refs if "eLIBRARY" in r["name"]), None)
    assert elib is not None
    assert "elibrary" in elib["url"].lower()


async def test_admin_database_stores_and_serves_url(client, auth):
    h = await auth("tech_umu")
    ok = await client.post("/api/admin/dictionary/database_name", headers=h,
                           json={"value": "Тестовая БД с URL", "extra": "https://test.example/"})
    assert ok.status_code == 201
    assert ok.json()["extra"] == "https://test.example/"

    refs = (await get_ok(client, h, "/api/suggestions/database_name/refs", q="Тестовая БД с URL"))["items"]
    assert any(r["url"] == "https://test.example/" for r in refs)
