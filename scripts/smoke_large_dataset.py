from __future__ import annotations

import argparse
import tempfile
import time
from pathlib import Path

from sqlalchemy import func, select, text

from dataset_studio.db.models import Project, Record
from dataset_studio.db.session import configure_database, session_factory
from dataset_studio.services.jsonl_exporter import export_to_path
from dataset_studio.services.jsonl_importer import decoded_lines, import_lines


def main() -> None:
    parser = argparse.ArgumentParser(description="Import, search, and export a large JSONL file")
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="dataset-studio-large-") as directory:
        configure_database(Path(directory) / "smoke.sqlite3")
        started = time.perf_counter()
        with session_factory()() as session, args.path.open("rb") as source:
            project = Project(name="large smoke", source_type="local")
            session.add(project)
            split = import_lines(session, project, "train", decoded_lines(source))
            imported = time.perf_counter()
            total = session.scalar(select(func.count()).select_from(Record))
            matches = session.scalar(
                text("SELECT count(*) FROM record_fts WHERE record_fts MATCH :query"),
                {"query": '"Question 99999"'},
            )
            target = Path(directory) / "export.jsonl"
            exported = export_to_path(session, split.id, target)
            finished = time.perf_counter()
            print(
                f"records={total} search_matches={matches} exported={exported} "
                f"import_seconds={imported - started:.2f} "
                f"export_seconds={finished - imported:.2f}"
            )


if __name__ == "__main__":
    main()
