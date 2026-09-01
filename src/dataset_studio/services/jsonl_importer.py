from __future__ import annotations

import json
from collections.abc import Iterable
from pathlib import Path
from typing import BinaryIO

from sqlalchemy.orm import Session

from dataset_studio.db.models import Project, Record, Split
from dataset_studio.services.jobs import Job
from dataset_studio.services.json_tools import search_text
from dataset_studio.services.schema_profiler import SchemaProfiler
from dataset_studio.services.search_index import index_new_records


class ImportFailure(Exception):
    def __init__(self, line: int, message: str, content: str = "") -> None:
        super().__init__(message)
        self.line = line
        self.content = content[:500]


def decoded_lines(stream: BinaryIO) -> Iterable[str]:
    for line_no, raw in enumerate(stream, 1):
        try:
            yield raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ImportFailure(line_no, f"Invalid UTF-8: {exc}") from exc


def import_lines(
    session: Session,
    project: Project,
    split_name: str,
    lines: Iterable[str],
    job: Job | None = None,
    batch_size: int = 1000,
) -> Split:
    split = Split(project=project, name=split_name, position=len(project.splits))
    session.add(split)
    session.flush()
    profiler = SchemaProfiler()
    batch: list[Record] = []
    position = 0
    try:
        for line_no, line in enumerate(lines, 1):
            if not line.strip():
                raise ImportFailure(line_no, "Blank lines are not valid JSONL records", line)
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ImportFailure(line_no, exc.msg, line) from exc
            if not isinstance(value, dict):
                raise ImportFailure(line_no, "Top-level JSON value must be an object", line)
            profiler.add(value)
            batch.append(
                Record(
                    split_id=split.id,
                    position=position,
                    original_json=value,
                    current_json=value,
                    search_text=search_text(value),
                )
            )
            position += 1
            if len(batch) >= batch_size:
                session.add_all(batch)
                session.flush()
                index_new_records(session, batch)
                batch.clear()
            if job:
                job.processed = position
                job.message = f"Reading dataset… {position:,}"
                job.progress = position / job.total if job.total else None
        if batch:
            session.add_all(batch)
            session.flush()
            index_new_records(session, batch)
        split.record_count = position
        project.inferred_schema = profiler.result()
        if project.identifier_field is None:
            paths = project.inferred_schema.get("paths", {})
            project.identifier_field = next(
                (name for name in ("id", "qa_id", "uuid") if name in paths), None
            )
        session.commit()
        return split
    except Exception:
        session.rollback()
        raise


def validate_local_path(raw_path: str) -> Path:
    path = Path(raw_path).expanduser().resolve()
    if path.suffix.lower() not in {".jsonl", ".ndjson"}:
        raise ValueError("File extension must be .jsonl or .ndjson")
    if not path.is_file():
        raise ValueError("File does not exist")
    try:
        with path.open("rb") as handle:
            handle.read(1)
    except OSError as exc:
        raise ValueError(f"File is not readable: {exc}") from exc
    return path
