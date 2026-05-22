import pytest
import pytest_asyncio

from .helpers import get_ok, my_id, bd_id_for, rpd_detail, make_sendable_rpd

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def uid(client, auth):
    cache = {}

    async def _uid(login_name):
        if login_name not in cache:
            cache[login_name] = await my_id(client, await auth(login_name))
        return cache[login_name]

    return _uid


async def _create_draft(client, headers, client_bd, reviewers):
    resp = await client.post("/api/rpd/", headers=headers, json={
        "bup_discipline_ids": [client_bd],
        "academic_year": "2099/2100",
        "reviewer_ids": reviewers,
    })
    assert resp.status_code == 201, resp.text
    return resp.json()["id_rpd"]


async def _sendable(client, auth, uid, reviewers):
    h = await auth("tech_umu")
    rid = await make_sendable_rpd(client, h, developer_id=await uid("tech_umu"), reviewers=reviewers)
    return h, rid


async def _current_reviewer_in_list(client, headers, rpd_id):
    rows = await get_ok(client, headers, "/api/rpd/", status="На согласовании")
    for r in rows:
        if r["id_rpd"] == rpd_id:
            return r["current_reviewer_id"]
    return None


async def test_send_without_route_fails(client, auth):
    h = await auth("tech_umu")
    bd = await bd_id_for(client, h, "Физика")
    resp = await client.post("/api/rpd/", headers=h, json={
        "bup_discipline_ids": [bd], "academic_year": "2099/2100",
    })
    rid = resp.json()["id_rpd"]
    send = await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    assert send.status_code == 400
    assert "маршрут" in send.json()["detail"].lower()


async def test_send_without_developers_fails(client, auth, uid):
    h = await auth("tech_umu")
    bd = await bd_id_for(client, h, "Физика")
    rid = await _create_draft(client, h, bd, [await uid("petrov")])
    send = await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    assert send.status_code == 400
    assert "разработчик" in send.json()["detail"].lower()


async def test_send_with_incomplete_sections_fails(client, auth, uid):
    h = await auth("tech_umu")
    bd = await bd_id_for(client, h, "Физика")
    rid = await _create_draft(client, h, bd, [await uid("petrov")])
    await client.post(f"/api/rpd/{rid}/developers", headers=h, params={"user_id": await uid("tech_umu")})
    send = await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    assert send.status_code == 400
    assert "обязательные разделы" in send.json()["detail"]


async def test_send_by_non_developer_forbidden(client, auth, uid):
    h, rid = await _sendable(client, auth, uid, [await uid("petrov")])
    resp = await client.post(f"/api/rpd/{rid}/send-approval", headers=await auth("kozlova"))
    assert resp.status_code == 403
    assert "разработчик" in resp.json()["detail"].lower()


async def test_single_step_approve(client, auth, uid):
    h, rid = await _sendable(client, auth, uid, [await uid("petrov")])

    send = await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    assert send.status_code == 200, send.text
    detail = await rpd_detail(client, h, rid)
    assert detail["status"] == "На согласовании"
    assert detail["approval_route"][0]["status"] == "pending"
    assert await _current_reviewer_in_list(client, h, rid) == await uid("petrov")

    review = await client.post(f"/api/rpd/{rid}/review", headers=await auth("petrov"),
                               json={"action": "approve"})
    assert review.status_code == 200, review.text
    detail = await rpd_detail(client, h, rid)
    assert detail["status"] == "Согласовано"
    assert detail["approval_route"][0]["status"] == "approved"
    assert await _current_reviewer_in_list(client, h, rid) is None


async def test_reject_then_resend(client, auth, uid):
    h, rid = await _sendable(client, auth, uid, [await uid("petrov")])
    await client.post(f"/api/rpd/{rid}/send-approval", headers=h)

    rej = await client.post(f"/api/rpd/{rid}/review", headers=await auth("petrov"),
                            json={"action": "reject", "comment": "Доработать раздел 4"})
    assert rej.status_code == 200, rej.text
    detail = await rpd_detail(client, h, rid)
    assert detail["status"] == "На доработке"
    assert detail["approval_route"][0]["status"] == "rejected"

    resend = await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    assert resend.status_code == 200
    detail = await rpd_detail(client, h, rid)
    assert detail["status"] == "На согласовании"
    assert detail["approval_route"][0]["status"] == "pending"
    assert detail["approval_route"][0]["comment"] is None


async def test_multi_step_chain(client, auth, uid):
    chain = [await uid("petrov"), await uid("solovieva"), await uid("orlov")]
    h, rid = await _sendable(client, auth, uid, chain)
    await client.post(f"/api/rpd/{rid}/send-approval", headers=h)

    assert await _current_reviewer_in_list(client, h, rid) == await uid("petrov")
    r1 = await client.post(f"/api/rpd/{rid}/review", headers=await auth("petrov"), json={"action": "approve"})
    assert r1.status_code == 200
    assert await _current_reviewer_in_list(client, h, rid) == await uid("solovieva")

    r2 = await client.post(f"/api/rpd/{rid}/review", headers=await auth("solovieva"), json={"action": "approve"})
    assert r2.status_code == 200
    assert await _current_reviewer_in_list(client, h, rid) == await uid("orlov")

    r3 = await client.post(f"/api/rpd/{rid}/review", headers=await auth("orlov"), json={"action": "approve"})
    assert r3.status_code == 200
    detail = await rpd_detail(client, h, rid)
    assert detail["status"] == "Согласовано"
    assert [s["status"] for s in detail["approval_route"]] == ["approved", "approved", "approved"]


async def test_review_by_wrong_reviewer(client, auth, uid):
    h, rid = await _sendable(client, auth, uid, [await uid("petrov"), await uid("orlov")])
    await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    resp = await client.post(f"/api/rpd/{rid}/review", headers=await auth("orlov"), json={"action": "approve"})
    assert resp.status_code == 403
    assert "другому" in resp.json()["detail"]


async def test_review_without_approve_permission(client, auth, uid):
    h, rid = await _sendable(client, auth, uid, [await uid("petrov")])
    await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    resp = await client.post(f"/api/rpd/{rid}/review", headers=await auth("ivanov"), json={"action": "approve"})
    assert resp.status_code == 403


async def test_cannot_send_when_already_approved(client, auth, uid):
    h, rid = await _sendable(client, auth, uid, [await uid("petrov")])
    await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    await client.post(f"/api/rpd/{rid}/review", headers=await auth("petrov"), json={"action": "approve"})
    resp = await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    assert resp.status_code == 400


async def test_approvals_history_recorded(client, auth, uid):
    h, rid = await _sendable(client, auth, uid, [await uid("petrov")])
    await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    await client.post(f"/api/rpd/{rid}/review", headers=await auth("petrov"),
                      json={"action": "approve", "comment": "ок"})
    history = await get_ok(client, h, f"/api/rpd/{rid}/approvals")
    assert len(history) >= 2
    assert any(a["status"] == "Согласовано" for a in history)


async def test_route_owner_can_edit_in_draft(client, auth, uid):
    h = await auth("tech_umu")
    bd = await bd_id_for(client, h, "Физика")
    rid = await _create_draft(client, h, bd, [await uid("petrov")])
    resp = await client.put(f"/api/rpd/{rid}/approval-route", headers=h,
                            json={"reviewer_ids": [await uid("petrov"), await uid("orlov")]})
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["approval_route"]) == 2


async def test_route_non_owner_without_perm_forbidden(client, auth, uid):
    h = await auth("tech_umu")
    bd = await bd_id_for(client, h, "Физика")
    rid = await _create_draft(client, h, bd, [await uid("petrov")])
    resp = await client.put(f"/api/rpd/{rid}/approval-route", headers=await auth("kozlova"),
                            json={"reviewer_ids": [await uid("orlov")]})
    assert resp.status_code == 403


async def test_route_chain_perm_user_edits_during_review(client, auth, uid):
    h, rid = await _sendable(client, auth, uid, [await uid("petrov")])
    await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    resp = await client.put(f"/api/rpd/{rid}/approval-route", headers=await auth("solovieva"),
                            json={"reviewer_ids": [await uid("orlov"), await uid("petrov")]})
    assert resp.status_code == 200, resp.text
    route = resp.json()["approval_route"]
    assert route[0]["id_reviewer"] == await uid("orlov")
    assert route[0]["status"] == "pending"


async def test_send_requires_tematiki_when_lab_hours(client, auth, uid):
    h, rid = await _sendable(client, auth, uid, [await uid("petrov")])
    add_sec = await client.post(f"/api/rpd/{rid}/sections", headers=h, json={
        "section_number": 2, "title": "Раздел с ЛР", "lecture_hours": 0,
        "practice_hours": 0, "lab_hours": 4, "self_study_hours": 0, "semester": 1,
    })
    assert add_sec.status_code == 201, add_sec.text
    bad = await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    assert bad.status_code == 400
    assert "4.2" in bad.json()["detail"]

    topic = await client.post(f"/api/rpd/{rid}/topics", headers=h, json={"topic_type": "lab", "title": "ЛР 1"})
    assert topic.status_code == 201, topic.text
    ok = await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    assert ok.status_code == 200, ok.text


async def test_route_cannot_change_when_approved(client, auth, uid):
    h, rid = await _sendable(client, auth, uid, [await uid("petrov")])
    await client.post(f"/api/rpd/{rid}/send-approval", headers=h)
    await client.post(f"/api/rpd/{rid}/review", headers=await auth("petrov"), json={"action": "approve"})
    resp = await client.put(f"/api/rpd/{rid}/approval-route", headers=h,
                            json={"reviewer_ids": [await uid("orlov")]})
    assert resp.status_code == 400
