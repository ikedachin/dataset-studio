from __future__ import annotations

from typing import Any


def structural_diff(original: Any, current: Any, path: str = "$") -> list[dict[str, Any]]:
    if isinstance(original, dict) and isinstance(current, dict):
        changes: list[dict[str, Any]] = []
        for key in original.keys() | current.keys():
            child = f"{path}.{key}"
            if key not in original:
                changes.append({"path": child, "kind": "added", "after": current[key]})
            elif key not in current:
                changes.append({"path": child, "kind": "removed", "before": original[key]})
            else:
                changes.extend(structural_diff(original[key], current[key], child))
        return changes
    if isinstance(original, list) and isinstance(current, list):
        changes = []
        for index in range(max(len(original), len(current))):
            child = f"{path}[{index}]"
            if index >= len(original):
                changes.append({"path": child, "kind": "added", "after": current[index]})
            elif index >= len(current):
                changes.append({"path": child, "kind": "removed", "before": original[index]})
            else:
                changes.extend(structural_diff(original[index], current[index], child))
        return changes
    if original != current:
        return [{"path": path, "kind": "modified", "before": original, "after": current}]
    return []
