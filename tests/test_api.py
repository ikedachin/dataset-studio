from __future__ import annotations

from pathlib import Path

from conftest import import_file

DATA = (
    "\n".join(
        [
            '{"id":"a","question":"今治市について","score":1,"metadata":{"source":"Wiki"}}',
            '{"id":"b","question":"松山市について","score":2,"metadata":{"source":"Book"}}',
        ]
    )
    + "\n"
)


def test_crud_lifecycle(client, tmp_path: Path) -> None:
    _, split = import_file(client, tmp_path, DATA)
    listing = client.get(f"/api/splits/{split}/records").json()
    record_id = listing["items"][0]["id"]
    record = client.get(f"/api/records/{record_id}").json()
    value = {**record["current_json"], "question": "編集済み"}
    updated = client.patch(
        f"/api/records/{record_id}", json={"current_json": value, "version": record["version"]}
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "edited"
    conflict = client.patch(
        f"/api/records/{record_id}", json={"current_json": value, "version": record["version"]}
    )
    assert conflict.status_code == 409
    duplicate = client.post(f"/api/records/{record_id}/duplicate").json()
    assert duplicate["is_new"] is True
    assert duplicate["current_json"] == value
    added = client.post(f"/api/splits/{split}/records", json={"current_json": {"new": True}}).json()
    assert added["status"] == "new"
    deleted = client.delete(f"/api/records/{record_id}").json()
    assert deleted["is_deleted"] is True
    restored = client.post(f"/api/records/{record_id}/restore").json()
    assert restored["current_json"]["question"] == "今治市について"
    assert restored["is_deleted"] is False


def test_diff_search_and_filters(client, tmp_path: Path) -> None:
    _, split = import_file(client, tmp_path, DATA)
    item = client.get(f"/api/splits/{split}/records", params={"search": "Wikipedia"}).json()
    assert item["total"] == 0
    item = client.get(f"/api/splits/{split}/records", params={"search": "Wiki"}).json()
    assert item["total"] == 1
    rules = (
        '[{"path":"score","operator":"gte","value":2},'
        '{"path":"metadata.source","operator":"exists"}]'
    )
    filtered = client.get(f"/api/splits/{split}/records", params={"filters": rules}).json()
    assert filtered["total"] == 1
    record_id = filtered["items"][0]["id"]
    record = client.get(f"/api/records/{record_id}").json()
    record["current_json"]["extra"] = "new"
    client.patch(
        f"/api/records/{record_id}",
        json={"current_json": record["current_json"], "version": record["version"]},
    )
    changes = client.get(f"/api/records/{record_id}/diff").json()["changes"]
    assert {"path": "$.extra", "kind": "added", "after": "new"} in changes


def test_duplicate_identifier_and_required_validation(client, tmp_path: Path) -> None:
    project, split = import_file(client, tmp_path, DATA)
    client.patch(
        f"/api/projects/{project}", json={"required_fields": ["answer"], "identifier_field": "id"}
    )
    record_id = client.get(f"/api/splits/{split}/records").json()["items"][0]["id"]
    duplicate = client.post(f"/api/records/{record_id}/duplicate").json()
    result = client.post(f"/api/records/{duplicate['id']}/validate").json()
    messages = {issue["message"] for issue in result["issues"]}
    assert "Required field is missing" in messages
    assert "Duplicate identifier" in messages


def test_messages_validation(client, tmp_path: Path) -> None:
    project, split = import_file(
        client, tmp_path, '{"messages":[{"role":"user","content":"hello"}]}\n'
    )
    record = client.get(
        f"/api/records/{client.get(f'/api/splits/{split}/records').json()['items'][0]['id']}"
    ).json()
    record["current_json"]["messages"] = [{"role": 4}]
    updated = client.patch(
        f"/api/records/{record['id']}",
        json={"current_json": record["current_json"], "version": record["version"]},
    ).json()
    assert updated["validation_status"] == "error"
