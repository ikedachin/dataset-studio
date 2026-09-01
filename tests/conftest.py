from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from dataset_studio.config import Settings
from dataset_studio.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    with TestClient(create_app(Settings(tmp_path))) as test_client:
        yield test_client


def import_file(
    client: TestClient, tmp_path: Path, content: str, name: str = "dataset.jsonl"
) -> tuple[int, int]:
    path = tmp_path / name
    path.write_text(content, encoding="utf-8")
    response = client.post("/api/import/local", json={"path": str(path), "split": "train"})
    assert response.status_code == 202, response.text
    job_id = response.json()["job_id"]
    import time

    for _ in range(200):
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] == "completed":
            return job["result"]["project_id"], job["result"]["split_id"]
        if job["status"] == "failed":
            raise AssertionError(job)
        time.sleep(0.01)
    raise AssertionError("Import did not finish")
