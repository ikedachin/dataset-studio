from __future__ import annotations

from pathlib import Path

import pytest

from dataset_studio.config import Settings


def test_default_data_dir_is_current_working_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)

    settings = Settings.default()

    assert settings.data_dir == tmp_path.resolve()
    assert settings.database_path == tmp_path.resolve() / "dataset-studio.sqlite3"
