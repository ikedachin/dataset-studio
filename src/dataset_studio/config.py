from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from platformdirs import user_data_path


@dataclass(slots=True)
class Settings:
    data_dir: Path

    @classmethod
    def default(cls) -> Settings:
        return cls(Path(user_data_path("Dataset Studio", "Dataset Studio")))

    @property
    def database_path(self) -> Path:
        return self.data_dir / "dataset-studio.sqlite3"
