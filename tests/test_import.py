from __future__ import annotations

from io import StringIO

import pytest

from dataset_studio.db.models import Project
from dataset_studio.services.jsonl_importer import ImportFailure, import_lines


@pytest.mark.parametrize(
    "line",
    [
        '{"text":"hello"}\n',
        '{"metadata":{"source":"Wikipedia","score":0.92},"tags":["日本語"]}\n',
        '{"messages":[{"role":"user","content":"こんにちは"},{"role":"assistant","content":"今治市です"}]}\n',
        '{"items":[{"label":"A"},{"label":"B"}],"values":[1,2,3]}\n',
    ],
)
def test_streaming_import_shapes(client, line: str) -> None:
    from dataset_studio.db.session import session_factory

    with session_factory()() as session:
        project = Project(name="test", source_type="upload")
        session.add(project)
        split = import_lines(session, project, "train", StringIO(line))
        assert split.record_count == 1
        assert project.inferred_schema["total_records"] == 1


@pytest.mark.parametrize(
    ("line", "message"),
    [
        ('{"broken":}\n', "Expecting value"),
        ('["not-object"]\n', "Top-level"),
        ('"not-object"\n', "Top-level"),
    ],
)
def test_invalid_import_rolls_back(client, line: str, message: str) -> None:
    from dataset_studio.db.session import session_factory

    with session_factory()() as session:
        project = Project(name="test", source_type="upload")
        session.add(project)
        with pytest.raises(ImportFailure, match=message) as error:
            import_lines(session, project, "train", StringIO(line))
        assert error.value.line == 1


def test_schema_inference_collects_nested_paths(client) -> None:
    from dataset_studio.db.session import session_factory

    with session_factory()() as session:
        project = Project(name="test", source_type="upload")
        session.add(project)
        import_lines(
            session,
            project,
            "train",
            StringIO('{"metadata":{"score":1},"messages":[{"role":"user","content":"a\\nb"}]}\n'),
        )
        paths = project.inferred_schema["paths"]
        assert paths["metadata.score"]["types"]["number"] == 1
        assert paths["messages[].content"]["multiline_ratio"] == 1
