import pytest

from .helpers import get_ok, my_id, make_sendable_rpd

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_notifications_on_send_for_reviewer_and_author(client, auth):
    author_h = await auth("tech_umu")
    rector_h = await auth("rector")
    rector_id = await my_id(client, rector_h)
    author_id = await my_id(client, author_h)

    rid = await make_sendable_rpd(client, author_h, developer_id=author_id, reviewers=[rector_id])

    before = (await get_ok(client, rector_h, "/api/notifications/unread-count"))["count"]
    send = await client.post(f"/api/rpd/{rid}/send-approval", headers=author_h)
    assert send.status_code == 200

    after = (await get_ok(client, rector_h, "/api/notifications/unread-count"))["count"]
    assert after > before

    rector_notifs = await get_ok(client, rector_h, "/api/notifications/")
    assert any("поступила" in n["message"] for n in rector_notifs)

    author_notifs = await get_ok(client, author_h, "/api/notifications/")
    assert any("отправлена на согласование" in n["message"] for n in author_notifs)


async def test_mark_one_and_all_read(client, auth):
    h = await auth("rector")
    notifs = await get_ok(client, h, "/api/notifications/")
    unread = [n for n in notifs if not n["is_read"]]
    if unread:
        one = await client.post(f"/api/notifications/{unread[0]['id_notification']}/read", headers=h)
        assert one.status_code == 200

    allr = await client.post("/api/notifications/read-all", headers=h)
    assert allr.status_code == 200
    count = (await get_ok(client, h, "/api/notifications/unread-count"))["count"]
    assert count == 0


async def test_mark_foreign_notification_404(client, auth):
    h = await auth("ivanov")
    resp = await client.post("/api/notifications/999999/read", headers=h)
    assert resp.status_code == 404
