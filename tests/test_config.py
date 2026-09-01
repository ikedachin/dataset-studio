from __future__ import annotations

from pathlib import Path

import pytest

from dataset_studio.config import ConfigError, Settings


def test_default_data_dir_is_current_working_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)

    settings = Settings.default()

    assert settings.data_dir == tmp_path.resolve()
    assert settings.database_path == tmp_path.resolve() / "dataset-studio.sqlite3"


def test_default_loads_yaml_from_current_working_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / "dataset-studio.yaml").write_text(
        "data_dir: ./workspace/data\n", encoding="utf-8"
    )

    settings = Settings.default()

    assert settings.data_dir == (tmp_path / "workspace/data").resolve()


def test_yaml_relative_data_dir_is_resolved_from_config_file(tmp_path: Path) -> None:
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    config_path = config_dir / "custom.yml"
    config_path.write_text("data_dir: ../database\n", encoding="utf-8")

    settings = Settings.load(config_path=config_path)

    assert settings.data_dir == (tmp_path / "database").resolve()


def test_data_dir_argument_overrides_yaml(tmp_path: Path) -> None:
    config_path = tmp_path / "dataset-studio.yaml"
    config_path.write_text("data_dir: from-yaml\n", encoding="utf-8")
    override = tmp_path / "from-command-line"

    settings = Settings.load(data_dir=override, config_path=config_path)

    assert settings.data_dir == override.resolve()


@pytest.mark.parametrize(
    ("content", "message"),
    [
        ("- not-a-mapping\n", "root must be a mapping"),
        ("data-dir: typo\n", "Unknown configuration field"),
        ("data_dir: null\n", "data_dir must be a non-empty string"),
    ],
)
def test_invalid_yaml_configuration_is_rejected(
    tmp_path: Path, content: str, message: str
) -> None:
    config_path = tmp_path / "dataset-studio.yaml"
    config_path.write_text(content, encoding="utf-8")

    with pytest.raises(ConfigError, match=message):
        Settings.load(config_path=config_path)


def test_missing_explicit_config_is_rejected(tmp_path: Path) -> None:
    with pytest.raises(ConfigError, match="does not exist"):
        Settings.load(config_path=tmp_path / "missing.yaml")
