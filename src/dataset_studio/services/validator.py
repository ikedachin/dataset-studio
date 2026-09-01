from __future__ import annotations

import json
from collections import Counter
from collections.abc import Iterable
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from dataset_studio.db.models import Project, Record
from dataset_studio.services.json_tools import get_path
from dataset_studio.services.schema_profiler import json_type


def identifier_key(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def validate_record(
    session: Session,
    record: Record,
    project: Project,
    identifier_counts: Counter[tuple[int, str]] | None = None,
) -> list[dict[str, str]]:
    value = record.current_json
    issues: list[dict[str, str]] = []
    for field in project.required_fields or []:
        exists, item = get_path(value, field)
        if not exists or item is None or item == "":
            issues.append({"level": "error", "path": field, "message": "Required field is missing"})
    messages = value.get("messages")
    schema_paths = (project.inferred_schema or {}).get("paths", {})
    if messages is not None and "messages[].role" in schema_paths:
        if not isinstance(messages, list):
            issues.append({"level": "error", "path": "messages", "message": "Must be an array"})
        else:
            for index, message in enumerate(messages):
                if (
                    not isinstance(message, dict)
                    or not isinstance(message.get("role"), str)
                    or not isinstance(message.get("content"), str)
                ):
                    issues.append(
                        {
                            "level": "error",
                            "path": f"messages[{index}]",
                            "message": "Message requires string role and content",
                        }
                    )
    for path, stat in schema_paths.items():
        exists, item = get_path(value, path)
        types = stat.get("types", {})
        dominant = max(types, key=types.get) if types else None
        if exists and dominant and json_type(item) != dominant and json_type(item) != "null":
            issues.append(
                {
                    "level": "warning",
                    "path": path,
                    "message": f"Expected mostly {dominant}, found {json_type(item)}",
                }
            )
    identifier = project.identifier_field
    if identifier:
        exists, item = get_path(value, identifier)
        if not exists or item is None or item == "":
            issues.append(
                {
                    "level": "error",
                    "path": identifier,
                    "message": "Identifier field is missing",
                }
            )
        else:
            duplicate = (
                identifier_counts[(record.split_id, identifier_key(item))] > 1
                if identifier_counts is not None
                else any(
                    get_path(candidate.current_json, identifier) == (True, item)
                    for candidate in session.scalars(
                        select(Record).where(
                            Record.split_id == record.split_id,
                            Record.id != record.id,
                            Record.is_deleted.is_(False),
                        )
                    ).all()
                )
            )
            if duplicate:
                issues.append(
                    {"level": "error", "path": identifier, "message": "Duplicate identifier"}
                )
    return issues


def update_validation(
    session: Session,
    record: Record,
    project: Project,
    identifier_counts: Counter[tuple[int, str]] | None = None,
) -> list[dict[str, str]]:
    issues = validate_record(session, record, project, identifier_counts)
    record.validation_issues = issues
    record.validation_status = (
        "error" if any(i["level"] == "error" for i in issues) else "warning" if issues else "valid"
    )
    return issues


def validate_records(
    session: Session, records: Iterable[Record], project: Project
) -> dict[str, int]:
    items = list(records)
    identifier_counts: Counter[tuple[int, str]] | None = None
    if project.identifier_field:
        identifier_counts = Counter(
            (record.split_id, identifier_key(value))
            for record in items
            for exists, value in [get_path(record.current_json, project.identifier_field)]
            if exists and value is not None and value != ""
        )
    counts = {"valid": 0, "warning": 0, "error": 0}
    for record in items:
        update_validation(session, record, project, identifier_counts)
        counts[record.validation_status] += 1
    return {"total": len(items), **counts}
