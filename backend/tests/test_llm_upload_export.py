import pytest
import pytest_asyncio

from .helpers import get_ok, find_rpd, bd_id_for

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture
async def draft_id(client, auth):
    h = await auth("tech_umu")
    bd = await bd_id_for(client, h, "Физика")
    resp = await client.post("/api/rpd/", headers=h, json={
        "bup_discipline_ids": [bd], "academic_year": "2099/2100",
    })
    assert resp.status_code == 201, resp.text
    return resp.json()["id_rpd"]


async def test_generate_text_section_demo(client, auth, draft_id):
    h = await auth("tech_umu")
    resp = await client.post(f"/api/llm/{draft_id}/generate", headers=h, json={"section": "goals"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["section"] == "goals"
    assert body["generated_text"].strip()
    assert body["model"]
    assert body["context_limit"] > 0


async def test_generate_learning_outcomes_demo(client, auth, draft_id):
    h = await auth("tech_umu")
    resp = await client.post(f"/api/llm/{draft_id}/generate", headers=h, json={"section": "learning_outcomes"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["generated_text"].strip()


async def test_generation_logged(client, auth, draft_id):
    h = await auth("tech_umu")
    await client.post(f"/api/llm/{draft_id}/generate", headers=h, json={"section": "objects"})
    logs = await get_ok(client, h, f"/api/llm/{draft_id}/logs")
    assert any(l["section_name"] == "objects" for l in logs)
    assert all(l["model_name"] for l in logs)


async def test_generate_missing_rpd(client, auth):
    resp = await client.post("/api/llm/999999/generate", headers=await auth("tech_umu"),
                             json={"section": "goals"})
    assert resp.status_code == 404


async def test_upload_document_lifecycle(client, auth, draft_id):
    h = await auth("tech_umu")
    files = {"file": ("context.txt", b"Testovyy kontekst dlya generacii.", "text/plain")}
    up = await client.post(f"/api/upload/{draft_id}", headers=h, files=files)
    assert up.status_code == 201, up.text
    doc_id = up.json()["id_document"]
    assert up.json()["filename"] == "context.txt"

    listed = await get_ok(client, h, f"/api/upload/{draft_id}")
    assert any(d["id_document"] == doc_id for d in listed)

    sections = await get_ok(client, h, f"/api/upload/doc/{doc_id}/sections")
    assert "context_char_limit" in sections

    delete = await client.delete(f"/api/upload/{doc_id}", headers=h)
    assert delete.status_code == 204


async def test_upload_rejects_bad_extension(client, auth, draft_id):
    h = await auth("tech_umu")
    files = {"file": ("evil.exe", b"MZ", "application/octet-stream")}
    resp = await client.post(f"/api/upload/{draft_id}", headers=h, files=files)
    assert resp.status_code == 400


async def test_upload_to_missing_rpd(client, auth):
    files = {"file": ("a.txt", b"x", "text/plain")}
    resp = await client.post("/api/upload/999999", headers=await auth("tech_umu"), files=files)
    assert resp.status_code == 404


async def test_export_pdf_of_approved_rpd(client, auth):
    h = await auth("ivanov")
    rpd = await find_rpd(client, h, discipline="Информатика", status="Согласовано")
    assert rpd
    resp = await client.get(f"/api/export/{rpd['id_rpd']}/pdf", headers=h)
    if resp.status_code == 500 and "ендер" in resp.text:
        pytest.xfail("LibreOffice/soffice недоступен в окружении — рендер PDF не выполнить")
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"


async def test_export_invalid_bd_id(client, auth):
    h = await auth("ivanov")
    rpd = await find_rpd(client, h, discipline="Информатика", status="Согласовано")
    resp = await client.get(f"/api/export/{rpd['id_rpd']}/pdf", headers=h, params={"bd_id": 999999})
    assert resp.status_code == 400
