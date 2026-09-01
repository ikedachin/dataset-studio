from __future__ import annotations

import re
from typing import Any

from dataset_studio.services.json_tools import get_path, set_path

_PLACEHOLDER = re.compile(r"{{\s*([^{}]+?)\s*}}")


def render_template(template: str, record: dict[str, Any]) -> str:
    def replace(match: re.Match[str]) -> str:
        exists, value = get_path(record, match.group(1))
        return str(value) if exists and value is not None else ""

    return _PLACEHOLDER.sub(replace, template)


def apply_sync(record: dict[str, Any], rules: list[dict[str, str]]) -> dict[str, Any]:
    result = record
    for rule in rules:
        if template := rule.get("template"):
            value: Any = render_template(template, result)
        else:
            exists, value = get_path(result, rule["source"])
            if not exists:
                continue
        result = set_path(result, rule["target"], value)
    return result
