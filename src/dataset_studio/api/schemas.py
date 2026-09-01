from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    source_type: str = "manual"
    source_metadata: dict[str, Any] = Field(default_factory=dict)


class ProjectSettings(BaseModel):
    name: str | None = None
    required_fields: list[str] | None = None
    identifier_field: str | None = None
    sync_rules: list[dict[str, str]] | None = None


class RecordUpdate(BaseModel):
    current_json: dict[str, Any]
    version: int


class RecordCreate(BaseModel):
    current_json: dict[str, Any] = Field(default_factory=dict)
    after_position: int | None = None


class LocalImport(BaseModel):
    path: str
    name: str | None = None
    split: str = "train"
    project_id: int | None = None


class HuggingFaceImport(BaseModel):
    repository_id: str
    config: str | None = None
    revision: str | None = None
    split: str
    name: str | None = None
    project_id: int | None = None


class ExportPath(BaseModel):
    split_id: int
    path: str
    overwrite: bool = False


class FilterRule(BaseModel):
    path: str
    operator: Literal[
        "equals",
        "not_equals",
        "contains",
        "not_contains",
        "exists",
        "missing",
        "empty",
        "not_empty",
        "gt",
        "gte",
        "lt",
        "lte",
    ]
    value: Any = None


class SyncRequest(BaseModel):
    rules: list[dict[str, str]]
    apply: bool = False
