async def get_ok(client, headers, url, **params):
    resp = await client.get(url, headers=headers, params=params or None)
    assert resp.status_code == 200, f"GET {url} -> {resp.status_code}: {resp.text}"
    return resp.json()


async def my_id(client, headers) -> int:
    me = await get_ok(client, headers, "/api/auth/me")
    return me["id_user"]


async def list_rpds(client, headers, **params):
    return await get_ok(client, headers, "/api/rpd/", **params)


async def rpd_detail(client, headers, rpd_id: int):
    return await get_ok(client, headers, f"/api/rpd/{rpd_id}")


async def find_rpd(client, headers, *, discipline=None, status=None, comment_prefix=None):
    rows = await list_rpds(client, headers)
    for r in rows:
        if discipline is not None and r["discipline_name"] != discipline:
            continue
        if status is not None and r["status"] != status:
            continue
        if comment_prefix is not None and not (r.get("comment") or "").startswith(comment_prefix):
            continue
        return r
    return None


async def bd_id_for(client, headers, discipline_name: str):
    """ID БУП-дисциплины, взятый из засеянной РПД этой дисциплины."""
    r = await find_rpd(client, headers, discipline=discipline_name)
    assert r, f"нет засеянной РПД для дисциплины {discipline_name}"
    detail = await rpd_detail(client, headers, r["id_rpd"])
    for link in detail["bup_disciplines"]:
        if link.get("id_bup_discipline"):
            return link["id_bup_discipline"]
    raise AssertionError(f"у РПД {discipline_name} нет БУП-привязки с id")


async def reviewer_ids(client, headers, *logins, login_fixture=None):
    """id_user для списка логинов (через их собственный /me)."""
    ids = []
    for lg in logins:
        token = await login_fixture(lg)
        h = {"Authorization": f"Bearer {token}"}
        ids.append(await my_id(client, h))
    return ids


async def make_sendable_rpd(client, headers, *, developer_id, reviewers,
                            discipline="Физика", academic_year="2099/2100"):
    """Создаёт черновик, проходящий все проверки send-approval: разработчик,
    заполненные обязательные разделы и прикреплённый ФОС."""
    bd = await bd_id_for(client, headers, discipline)
    created = await client.post("/api/rpd/", headers=headers, json={
        "bup_discipline_ids": [bd], "academic_year": academic_year, "reviewer_ids": reviewers,
    })
    assert created.status_code == 201, created.text
    rid = created.json()["id_rpd"]

    dev = await client.post(f"/api/rpd/{rid}/developers", headers=headers, params={"user_id": developer_id})
    assert dev.status_code == 201, dev.text

    patch = await client.patch(f"/api/rpd/{rid}", headers=headers, json={
        "goals_text": "Цель.", "objects_text": "Объекты.", "requirements_text": "Требования.",
        "educational_tech": "Технологии.", "methodical_recommendations": "Рекомендации.",
    })
    assert patch.status_code == 200, patch.text

    sec = await client.post(f"/api/rpd/{rid}/sections", headers=headers, json={
        "section_number": 1, "title": "Раздел 1", "lecture_hours": 4,
        "practice_hours": 0, "lab_hours": 0, "self_study_hours": 8, "semester": 1,
    })
    assert sec.status_code == 201, sec.text

    lit = await client.post(f"/api/rpd/{rid}/literature", headers=headers, json={
        "source_type": "Учебные и научные издания", "title": "Учебник",
    })
    assert lit.status_code == 201, lit.text

    mt = await client.post(f"/api/rpd/{rid}/material-tech", headers=headers, json={
        "room_type": "Лекция", "equipment": "Проектор",
    })
    assert mt.status_code == 201, mt.text

    sw = await client.post(f"/api/rpd/{rid}/software", headers=headers, json={
        "name": "VS Code", "license_type": "Среды разработки, тестирования и отладки",
    })
    assert sw.status_code == 201, sw.text

    dbr = await client.post(f"/api/rpd/{rid}/databases", headers=headers, json={
        "name": "eLIBRARY", "url": "https://elibrary.ru/",
    })
    assert dbr.status_code == 201, dbr.text

    el = await client.post(f"/api/rpd/{rid}/literature", headers=headers, json={
        "source_type": "Основная литература", "title": "Электронный учебник",
        "url": "https://e.lanbook.com/", "availability": ["сеть Интернет", "свободный доступ"],
    })
    assert el.status_code == 201, el.text

    detail = await rpd_detail(client, headers, rid)
    los = detail["learning_outcomes"]
    assert los, "ожидались автозаполненные результаты обучения"
    ups = await client.post(f"/api/rpd/{rid}/outcomes/upsert", headers=headers, json={
        "id_outcome": los[0]["id_outcome"], "outcome_text": "Знает", "assessment_tool": "Экзамен",
    })
    assert ups.status_code == 200, ups.text

    fos = await client.post(
        f"/api/rpd/{rid}/fos", headers=headers,
        data={"role": "main"},
        files={"file": ("fos.pdf", b"%PDF-1.4 test fos", "application/pdf")},
    )
    assert fos.status_code == 201, fos.text
    return rid


async def create_draft_from_bup(client, headers, discipline_name, reviewers, *, academic_year="2025/2026"):
    bd = await bd_id_for(client, headers, discipline_name)
    resp = await client.post(
        "/api/rpd/",
        headers=headers,
        json={
            "bup_discipline_ids": [bd],
            "academic_year": academic_year,
            "reviewer_ids": reviewers,
        },
    )
    assert resp.status_code == 201, f"create rpd -> {resp.status_code}: {resp.text}"
    return resp.json()
