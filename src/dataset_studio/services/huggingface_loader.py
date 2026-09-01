from __future__ import annotations

import os
from collections.abc import Iterable
from typing import Any

from datasets import get_dataset_config_names, get_dataset_split_names, load_dataset


def dataset_options(repository_id: str, revision: str | None = None) -> dict[str, Any]:
    token = os.environ.get("HF_TOKEN")
    configs = get_dataset_config_names(repository_id, revision=revision, token=token)
    splits: dict[str, list[str]] = {}
    for config in configs:
        splits[config] = get_dataset_split_names(
            repository_id, config, revision=revision, token=token
        )
    return {"configs": configs, "splits": splits}


def stream_dataset(
    repository_id: str, config: str | None, split: str, revision: str | None
) -> Iterable[dict[str, Any]]:
    dataset = load_dataset(
        repository_id,
        name=config,
        split=split,
        revision=revision,
        token=os.environ.get("HF_TOKEN"),
        streaming=True,
    )
    yield from dataset


def as_json_lines(records: Iterable[dict[str, Any]]) -> Iterable[str]:
    import json

    for record in records:
        yield json.dumps(record, ensure_ascii=False)
