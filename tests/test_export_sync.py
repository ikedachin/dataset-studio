from __future__ import annotations

from pathlib import Path

from conftest import import_file


def test_sync_preview_and_apply(client, tmp_path: Path) -> None:
    _, split = import_file(
        client,
        tmp_path,
        '{"question":"Q","thinking":"考察","answer":"回答","messages":[{"role":"user","content":"old"},{"role":"assistant","content":"old"}]}\n',
    )
    record_id = client.get(f"/api/splits/{split}/records").json()["items"][0]["id"]
    rules = [
        {"source": "question", "target": "messages[0].content"},
        {
            "target": "messages[1].content",
            "template": "<think>{{ thinking }}</think>\n{{ answer }}",
        },
    ]
    preview = client.post(
        f"/api/records/{record_id}/sync", json={"rules": rules, "apply": False}
    ).json()
    assert preview["after"]["messages"][0]["content"] == "Q"
    original = client.get(f"/api/records/{record_id}").json()
    assert original["current_json"]["messages"][0]["content"] == "old"
    applied = client.post(
        f"/api/records/{record_id}/sync", json={"rules": rules, "apply": True}
    ).json()
    assert (
        applied["record"]["current_json"]["messages"][1]["content"] == "<think>考察</think>\n回答"
    )


def test_export_integrity(client, tmp_path: Path) -> None:
    _, split = import_file(client, tmp_path, '{"id":1,"text":"今治市"}\n{"id":2,"text":"削除"}\n')
    records = client.get(f"/api/splits/{split}/records").json()["items"]
    client.delete(f"/api/records/{records[1]['id']}")
    client.post(f"/api/splits/{split}/records", json={"current_json": {"id": 3, "text": "追加"}})
    response = client.get("/api/export/download", params={"split_id": split})
    assert response.status_code == 200
    assert response.content == '{"id":1,"text":"今治市"}\n{"id":3,"text":"追加"}\n'.encode()
    target = tmp_path / "export.jsonl"
    result = client.post("/api/export/path", json={"split_id": split, "path": str(target)}).json()
    assert result["records"] == 2
    assert target.read_bytes() == response.content
    assert (
        client.post("/api/export/path", json={"split_id": split, "path": str(target)}).status_code
        == 409
    )
