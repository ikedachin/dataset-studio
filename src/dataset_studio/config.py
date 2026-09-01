from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

CONFIG_FILENAMES = ("dataset-studio.yaml", "dataset-studio.yml")


class ConfigError(ValueError):
    """Raised when a Dataset Studio configuration file is invalid."""


@dataclass(slots=True)
class Settings:
    data_dir: Path

    @classmethod
    def default(cls) -> Settings:
        return cls.load()

    @classmethod
    def load(
        cls,
        *,
        data_dir: Path | None = None,
        config_path: Path | None = None,
    ) -> Settings:
        current_dir = Path.cwd().resolve()
        if data_dir is not None:
            return cls(_resolve_path(data_dir, current_dir))

        selected_config: Path | None = None
        if config_path is not None:
            selected_config = _resolve_path(config_path, current_dir)
            if not selected_config.is_file():
                raise ConfigError(f"Configuration file does not exist: {selected_config}")
        else:
            selected_config = next(
                (current_dir / name for name in CONFIG_FILENAMES if (current_dir / name).is_file()),
                None,
            )

        if selected_config is None:
            return cls(current_dir)
        return cls.from_yaml(selected_config)

    @classmethod
    def from_yaml(cls, config_path: Path) -> Settings:
        try:
            raw: Any = yaml.safe_load(config_path.read_text(encoding="utf-8"))
        except OSError as exc:
            raise ConfigError(f"Could not read configuration file {config_path}: {exc}") from exc
        except yaml.YAMLError as exc:
            raise ConfigError(f"Invalid YAML in {config_path}: {exc}") from exc

        if raw is None:
            raw = {}
        if not isinstance(raw, Mapping):
            raise ConfigError(f"Configuration root must be a mapping: {config_path}")

        unknown = {str(key) for key in raw if key != "data_dir"}
        if unknown:
            names = ", ".join(sorted(unknown))
            raise ConfigError(f"Unknown configuration field(s) in {config_path}: {names}")

        if "data_dir" not in raw:
            return cls(Path.cwd().resolve())
        value = raw["data_dir"]
        if not isinstance(value, str) or not value.strip():
            raise ConfigError(f"data_dir must be a non-empty string in {config_path}")

        return cls(_resolve_path(Path(value), config_path.parent))

    @property
    def database_path(self) -> Path:
        return self.data_dir / "dataset-studio.sqlite3"


def _resolve_path(path: Path, base_dir: Path) -> Path:
    expanded = path.expanduser()
    if not expanded.is_absolute():
        expanded = base_dir / expanded
    return expanded.resolve()
