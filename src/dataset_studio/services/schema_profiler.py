from __future__ import annotations

from collections import defaultdict
from typing import Any


def json_type(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    return "object"


class SchemaProfiler:
    def __init__(self) -> None:
        self.total = 0
        self.paths: dict[str, dict[str, Any]] = defaultdict(
            lambda: {
                "count": 0,
                "null_count": 0,
                "types": defaultdict(int),
                "max_length": 0,
                "multiline_count": 0,
            }
        )

    def add(self, record: dict[str, Any]) -> None:
        self.total += 1
        self._visit(record, "")

    def _visit(self, value: Any, path: str) -> None:
        if path:
            stat = self.paths[path]
            kind = json_type(value)
            stat["count"] += 1
            stat["types"][kind] += 1
            stat["null_count"] += int(value is None)
            if isinstance(value, str):
                stat["max_length"] = max(stat["max_length"], len(value))
                stat["multiline_count"] += int("\n" in value)
        if isinstance(value, dict):
            for key, child in value.items():
                self._visit(child, f"{path}.{key}" if path else key)
        elif isinstance(value, list):
            array_path = f"{path}[]"
            for child in value:
                if isinstance(child, dict):
                    for key, nested in child.items():
                        self._visit(nested, f"{array_path}.{key}")

    def result(self) -> dict[str, Any]:
        paths: dict[str, Any] = {}
        for path, stat in self.paths.items():
            item = dict(stat)
            item["types"] = dict(stat["types"])
            item["multiline_ratio"] = (
                stat["multiline_count"] / stat["count"] if stat["count"] else 0
            )
            paths[path] = item
        return {"total_records": self.total, "paths": paths}
