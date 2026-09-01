from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from dataset_studio.db.models import Project, Record
from dataset_studio.services.json_tools import get_path
from dataset_studio.services.schema_profiler import json_type


def validate_record(session: Session, record: Record, project: Project) -> list[dict[str, str]]:
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
        if exists and item is not None:
            candidates = session.scalars(
                select(Record).where(
                    Record.split_id == record.split_id,
                    Record.id != record.id,
                    Record.is_deleted.is_(False),
                )
            ).all()
            if any(
                get_path(candidate.current_json, identifier) == (True, item)
                for candidate in candidates
            ):
                issues.append(
                    {"level": "error", "path": identifier, "message": "Duplicate identifier"}
                )
    return issues


def update_validation(session: Session, record: Record, project: Project) -> list[dict[str, str]]:
    issues = validate_record(session, record, project)
    record.validation_issues = issues
    record.validation_status = (
        "error" if any(i["level"] == "error" for i in issues) else "warning" if issues else "valid"
    )
    return issues
