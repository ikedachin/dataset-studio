from __future__ import annotations

import copy
import re
from collections.abc import Iterator
from typing import Any


def scalar_values(value: Any) -> Iterator[str]:
    if isinstance(value, dict):
        for item in value.values():
            yield from scalar_values(item)
    elif isinstance(value, list):
        for item in value:
            yield from scalar_values(item)
    elif value is not None:
        yield str(value)


def search_text(value: dict[str, Any]) -> str:
    return "\n".join(scalar_values(value))


def preview(value: dict[str, Any], limit: int = 160) -> str:
    for key in ("question", "text", "input", "prompt", "answer"):
        candidate = value.get(key)
        if isinstance(candidate, (str, int, float, bool)) and str(candidate).strip():
            return str(candidate).replace("\n", " ")[:limit]
    for candidate in scalar_values(value):
        if candidate.strip():
            return candidate.replace("\n", " ")[:limit]
    return "Empty object"


_TOKEN = re.compile(r"([^[.]+)|\[(\d+)\]")


def path_tokens(path: str) -> list[str | int]:
    tokens: list[str | int] = []
    for name, index in _TOKEN.findall(path):
        tokens.append(int(index) if index else name)
    return tokens


def get_path(value: Any, path: str) -> tuple[bool, Any]:
    current = value
    for token in path_tokens(path):
        if isinstance(token, int) and isinstance(current, list) and token < len(current):
            current = current[token]
        elif isinstance(token, str) and isinstance(current, dict) and token in current:
            current = current[token]
        else:
            return False, None
    return True, current


def set_path(value: dict[str, Any], path: str, replacement: Any) -> dict[str, Any]:
    result = copy.deepcopy(value)
    tokens = path_tokens(path)
    if not tokens:
        raise ValueError("Path must not be empty")
    current: Any = result
    for index, token in enumerate(tokens[:-1]):
        next_token = tokens[index + 1]
        if isinstance(token, int):
            if not isinstance(current, list):
                raise ValueError(f"Expected an array at {path}")
            while len(current) <= token:
                current.append([] if isinstance(next_token, int) else {})
            current = current[token]
        else:
            if not isinstance(current, dict):
                raise ValueError(f"Expected an object at {path}")
            if token not in current:
                current[token] = [] if isinstance(next_token, int) else {}
            current = current[token]
    last = tokens[-1]
    if isinstance(last, int):
        if not isinstance(current, list):
            raise ValueError(f"Expected an array at {path}")
        while len(current) <= last:
            current.append(None)
        current[last] = replacement
    else:
        if not isinstance(current, dict):
            raise ValueError(f"Expected an object at {path}")
        current[last] = replacement
    return result
