from __future__ import annotations

import copy
import json
import shutil
import threading
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import Float, Text, cast, func, literal_column, select, text
from sqlalchemy.orm import Session

from dataset_studio.api.schemas import (
    ExportPath,
    FilterRule,
    HuggingFaceImport,
    LocalImport,
    ProjectCreate,
    ProjectSettings,
    RecordCreate,
    RecordUpdate,
    SyncRequest,
)
from dataset_studio.db.models import Project, Record, Split
from dataset_studio.db.session import get_session, session_factory
from dataset_studio.services.diff_service import structural_diff
from dataset_studio.services.huggingface_loader import (
    as_json_lines,
    dataset_options,
    stream_dataset,
)
from dataset_studio.services.jobs import Job, jobs
from dataset_studio.services.json_tools import path_tokens, preview, search_text
from dataset_studio.services.jsonl_exporter import export_lines, export_to_path
from dataset_studio.services.jsonl_importer import (
    ImportFailure,
    decoded_lines,
    import_lines,
    validate_local_path,
)
from dataset_studio.services.search_index import index_record
from dataset_studio.services.sync_service import apply_sync
from dataset_studio.services.validator import update_validation

api_router = APIRouter(prefix="/api")
DB = Annotated[Session, Depends(get_session)]


def project_view(project: Project) -> dict[str, Any]:
    return {
        "id": project.id,
        "name": project.name,
        "source_type": project.source_type,
        "source_metadata": project.source_metadata,
        "inferred_schema": project.inferred_schema,
        "sync_rules": project.sync_rules,
        "required_fields": project.required_fields,
        "identifier_field": project.identifier_field,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "splits": [
            {"id": s.id, "name": s.name, "position": s.position, "record_count": s.record_count}
            for s in sorted(project.splits, key=lambda item: item.position)
        ],
    }


def record_view(record: Record) -> dict[str, Any]:
    return {
        "id": record.id,
        "split_id": record.split_id,
        "position": record.position,
        "original_json": record.original_json,
        "current_json": record.current_json,
        "status": record.status,
        "is_new": record.is_new,
        "is_deleted": record.is_deleted,
        "version": record.version,
        "validation_status": record.validation_status,
        "validation_issues": record.validation_issues,
        "updated_at": record.updated_at,
    }


def get_or_404(session: Session, model: type[Any], item_id: int) -> Any:
    item = session.get(model, item_id)
    if item is None:
        raise HTTPException(
            404, detail={"code": "NOT_FOUND", "message": f"{model.__name__} not found"}
        )
    return item


@api_router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@api_router.get("/projects")
def list_projects(session: DB) -> list[dict[str, Any]]:
    return [
        project_view(p)
        for p in session.scalars(select(Project).order_by(Project.updated_at.desc())).unique()
    ]


@api_router.post("/projects", status_code=201)
def create_project(payload: ProjectCreate, session: DB) -> dict[str, Any]:
    project = Project(**payload.model_dump())
    session.add(project)
    session.commit()
    return project_view(project)


@api_router.get("/projects/{project_id}")
def get_project(project_id: int, session: DB) -> dict[str, Any]:
    return project_view(get_or_404(session, Project, project_id))


@api_router.patch("/projects/{project_id}")
def update_project(project_id: int, payload: ProjectSettings, session: DB) -> dict[str, Any]:
    project = get_or_404(session, Project, project_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    session.commit()
    return project_view(project)


@api_router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, session: DB) -> None:
    session.delete(get_or_404(session, Project, project_id))
    session.commit()


@api_router.get("/projects/{project_id}/splits")
def list_splits(project_id: int, session: DB) -> list[dict[str, Any]]:
    project = get_or_404(session, Project, project_id)
    return project_view(project)["splits"]


def sqlite_json_path(path: str) -> str:
    result = "$"
    for token in path_tokens(path):
        if isinstance(token, int):
            result += f"[{token}]"
        else:
            result += f'."{token.replace(chr(34), chr(34) * 2)}"'
    return result


def apply_filter(statement: Any, rule: FilterRule) -> Any:
    path = sqlite_json_path(rule.path)
    value = func.json_extract(Record.current_json, path)
    kind = func.json_type(Record.current_json, path)
    operator = rule.operator
    if operator == "exists":
        return statement.where(kind.is_not(None))
    if operator == "missing":
        return statement.where(kind.is_(None))
    if operator in {"empty", "not_empty"}:
        empty = (
            value.is_(None)
            | (cast(value, Text) == "")
            | (kind.in_(["array", "object"]) & (func.json_array_length(value) == 0))
        )
        return statement.where(kind.is_not(None), empty if operator == "empty" else ~empty)
    if operator == "equals":
        return statement.where(kind.is_not(None), value == rule.value)
    if operator == "not_equals":
        return statement.where(kind.is_not(None), value != rule.value)
    if operator == "contains":
        return statement.where(cast(value, Text).icontains(str(rule.value)))
    if operator == "not_contains":
        return statement.where(~cast(value, Text).icontains(str(rule.value)))
    numeric = cast(value, Float)
    expected = float(rule.value)
    comparisons = {
        "gt": numeric > expected,
        "gte": numeric >= expected,
        "lt": numeric < expected,
        "lte": numeric <= expected,
    }
    return statement.where(kind.in_(["integer", "real"]), comparisons[operator])


@api_router.get("/splits/{split_id}/records")
def list_records(
    split_id: int,
    session: DB,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: str = "",
    status: str = "all",
    include_deleted: bool = False,
    filters: str | None = None,
    sort_path: str | None = None,
    sort_direction: str = "asc",
) -> dict[str, Any]:
    get_or_404(session, Split, split_id)
    statement = select(Record).where(Record.split_id == split_id)
    if not include_deleted and status != "deleted":
        statement = statement.where(Record.is_deleted.is_(False))
    if status == "deleted":
        statement = statement.where(Record.is_deleted.is_(True))
    elif status == "new":
        statement = statement.where(Record.is_new.is_(True), Record.is_deleted.is_(False))
    elif status == "edited":
        statement = statement.where(Record.status == "edited", Record.is_deleted.is_(False))
    elif status == "unedited":
        statement = statement.where(Record.status == "unedited", Record.is_deleted.is_(False))
    elif status == "validation_error":
        statement = statement.where(Record.validation_status == "error")
    if search:
        phrase = f'"{search.replace(chr(34), chr(34) * 2)}"*'
        fts_ids = (
            select(literal_column("record_id"))
            .select_from(text("record_fts"))
            .where(text("record_fts MATCH :fts_query"))
        )
        statement = statement.where(Record.id.in_(fts_ids)).params(fts_query=phrase)
    parsed_rules = (
        [FilterRule.model_validate(item) for item in json.loads(filters)] if filters else []
    )
    for rule in parsed_rules:
        try:
            statement = apply_filter(statement, rule)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                422, detail={"code": "INVALID_FILTER", "message": str(exc)}
            ) from exc
    if sort_path:
        expression = func.json_extract(Record.current_json, sqlite_json_path(sort_path))
        order = expression.desc() if sort_direction == "desc" else expression.asc()
        statement = statement.order_by(order, Record.position, Record.id)
    else:
        statement = statement.order_by(Record.position, Record.id)
    total = (
        session.scalar(select(func.count()).select_from(statement.order_by(None).subquery())) or 0
    )
    page = list(session.scalars(statement.offset(offset).limit(limit)))
    return {
        "items": [
            {
                "id": r.id,
                "position": r.position,
                "status": r.status,
                "is_new": r.is_new,
                "is_deleted": r.is_deleted,
                "validation_status": r.validation_status,
                "preview": preview(r.current_json),
            }
            for r in page
        ],
        "offset": offset,
        "limit": limit,
        "total": total,
    }


@api_router.post("/splits/{split_id}/records", status_code=201)
def add_record(split_id: int, payload: RecordCreate, session: DB) -> dict[str, Any]:
    split = get_or_404(session, Split, split_id)
    max_position = session.scalar(
        select(func.max(Record.position)).where(Record.split_id == split_id)
    )
    position = (max_position if max_position is not None else -1) + 1
    record = Record(
        split_id=split_id,
        position=position,
        original_json=None,
        current_json=payload.current_json,
        search_text=search_text(payload.current_json),
        status="new",
        is_new=True,
    )
    session.add(record)
    session.flush()
    index_record(session, record)
    split.record_count += 1
    session.commit()
    return record_view(record)


@api_router.get("/records/{record_id}")
def get_record(record_id: int, session: DB) -> dict[str, Any]:
    return record_view(get_or_404(session, Record, record_id))


@api_router.patch("/records/{record_id}")
def patch_record(record_id: int, payload: RecordUpdate, session: DB) -> dict[str, Any]:
    record = get_or_404(session, Record, record_id)
    if record.version != payload.version:
        raise HTTPException(
            409,
            detail={
                "code": "VERSION_CONFLICT",
                "message": "Record was changed by a newer save",
                "details": {"current_version": record.version},
            },
        )
    record.current_json = payload.current_json
    record.search_text = search_text(payload.current_json)
    record.status = (
        "new"
        if record.is_new
        else "unedited"
        if record.original_json == payload.current_json
        else "edited"
    )
    record.version += 1
    project = record.split.project
    update_validation(session, record, project)
    index_record(session, record)
    session.commit()
    return record_view(record)


@api_router.delete("/records/{record_id}")
def soft_delete_record(record_id: int, session: DB) -> dict[str, Any]:
    record = get_or_404(session, Record, record_id)
    record.is_deleted = True
    record.status = "deleted"
    record.version += 1
    session.commit()
    return record_view(record)


@api_router.post("/records/{record_id}/restore")
def restore_record(record_id: int, session: DB) -> dict[str, Any]:
    record = get_or_404(session, Record, record_id)
    if record.is_new:
        record.is_deleted = False
        record.status = "new"
    else:
        record.current_json = copy.deepcopy(record.original_json or {})
        record.search_text = search_text(record.current_json)
        record.is_deleted = False
        record.status = "unedited"
    record.version += 1
    index_record(session, record)
    session.commit()
    return record_view(record)


@api_router.post("/records/{record_id}/duplicate", status_code=201)
def duplicate_record(record_id: int, session: DB) -> dict[str, Any]:
    source = get_or_404(session, Record, record_id)
    split = source.split
    position = (
        session.scalar(select(func.max(Record.position)).where(Record.split_id == source.split_id))
        or 0
    ) + 1
    record = Record(
        split_id=source.split_id,
        position=position,
        original_json=None,
        current_json=copy.deepcopy(source.current_json),
        search_text=source.search_text,
        status="new",
        is_new=True,
    )
    session.add(record)
    session.flush()
    index_record(session, record)
    split.record_count += 1
    session.commit()
    return record_view(record)


@api_router.get("/records/{record_id}/diff")
def diff_record(record_id: int, session: DB) -> dict[str, Any]:
    record = get_or_404(session, Record, record_id)
    return {"changes": structural_diff(record.original_json or {}, record.current_json)}


@api_router.post("/records/{record_id}/validate")
def validate_one(record_id: int, session: DB) -> dict[str, Any]:
    record = get_or_404(session, Record, record_id)
    issues = update_validation(session, record, record.split.project)
    session.commit()
    return {"status": record.validation_status, "issues": issues}


@api_router.post("/projects/{project_id}/validate")
def validate_project(project_id: int, session: DB) -> dict[str, Any]:
    project = get_or_404(session, Project, project_id)
    records = session.scalars(
        select(Record)
        .join(Split)
        .where(Split.project_id == project_id, Record.is_deleted.is_(False))
    ).yield_per(500)
    counts = {"valid": 0, "warning": 0, "error": 0}
    total = 0
    for record in records:
        update_validation(session, record, project)
        counts[record.validation_status] += 1
        total += 1
    session.commit()
    return {"total": total, **counts}


@api_router.post("/records/{record_id}/sync")
def sync_record(record_id: int, payload: SyncRequest, session: DB) -> dict[str, Any]:
    record = get_or_404(session, Record, record_id)
    after = apply_sync(record.current_json, payload.rules)
    changes = structural_diff(record.current_json, after)
    if payload.apply:
        record.current_json = after
        record.search_text = search_text(after)
        record.status = "new" if record.is_new else "edited"
        record.version += 1
        index_record(session, record)
        session.commit()
    return {
        "before": record.current_json if not payload.apply else None,
        "after": after,
        "changes": changes,
        "record": record_view(record) if payload.apply else None,
    }


def run_path_import(job: Job, project_id: int, path: Path, split_name: str) -> None:
    factory = session_factory()
    job.status = "running"
    try:
        with path.open("rb") as counter:
            job.total = sum(1 for _ in counter)
        with factory() as session, path.open("rb") as stream:
            project = get_or_404(session, Project, project_id)
            split = import_lines(session, project, split_name, decoded_lines(stream), job)
            job.status = "completed"
            job.result = {
                "project_id": project.id,
                "split_id": split.id,
                "records": split.record_count,
            }
            job.progress = 1.0
            job.message = "Import complete"
    except ImportFailure as exc:
        job.status = "failed"
        job.error = {
            "code": "JSONL_PARSE_ERROR",
            "message": str(exc),
            "details": {"line": exc.line, "content": exc.content},
        }
    except Exception as exc:
        job.status = "failed"
        job.error = {"code": "IMPORT_ERROR", "message": str(exc)}


@api_router.post("/import/local", status_code=202)
def import_local(payload: LocalImport, session: DB) -> dict[str, Any]:
    try:
        path = validate_local_path(payload.path)
    except ValueError as exc:
        raise HTTPException(422, detail={"code": "INVALID_PATH", "message": str(exc)}) from exc
    if payload.project_id:
        project = get_or_404(session, Project, payload.project_id)
    else:
        project = Project(
            name=payload.name or path.stem,
            source_type="local",
            source_metadata={"path": str(path)},
        )
        session.add(project)
        session.commit()
    job = jobs.create()
    threading.Thread(
        target=run_path_import, args=(job, project.id, path, payload.split), daemon=True
    ).start()
    return {"job_id": job.id, "project_id": project.id}


@api_router.post("/import/upload", status_code=202)
def import_upload(
    background: BackgroundTasks,
    session: DB,
    file: Annotated[UploadFile, File(...)],
    name: str | None = None,
    split: str = "train",
    project_id: int | None = None,
) -> dict[str, Any]:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".jsonl", ".ndjson"}:
        raise HTTPException(
            422, detail={"code": "INVALID_EXTENSION", "message": "Upload a .jsonl or .ndjson file"}
        )
    import tempfile

    descriptor, raw_path = tempfile.mkstemp(suffix=suffix)
    with open(descriptor, "wb", closefd=True) as output:
        shutil.copyfileobj(file.file, output)
    path = Path(raw_path)
    if project_id:
        project = get_or_404(session, Project, project_id)
    else:
        project = Project(
            name=name or Path(file.filename or "dataset").stem,
            source_type="upload",
            source_metadata={"filename": file.filename},
        )
        session.add(project)
        session.commit()
    job = jobs.create()

    def work() -> None:
        try:
            run_path_import(job, project.id, path, split)
        finally:
            path.unlink(missing_ok=True)

    threading.Thread(target=work, daemon=True).start()
    return {"job_id": job.id, "project_id": project.id}


@api_router.get("/import/huggingface/options")
def huggingface_options(repository_id: str, revision: str | None = None) -> dict[str, Any]:
    try:
        return dataset_options(repository_id, revision)
    except Exception as exc:
        raise HTTPException(422, detail={"code": "HF_ERROR", "message": str(exc)}) from exc


@api_router.post("/import/huggingface", status_code=202)
def import_huggingface(payload: HuggingFaceImport, session: DB) -> dict[str, Any]:
    if payload.project_id:
        project = get_or_404(session, Project, payload.project_id)
    else:
        project = Project(
            name=payload.name or payload.repository_id.split("/")[-1],
            source_type="huggingface",
            source_metadata=payload.model_dump(exclude={"name", "project_id"}),
        )
        session.add(project)
        session.commit()
    job = jobs.create()

    def work() -> None:
        factory = session_factory()
        job.status = "running"
        try:
            with factory() as db:
                p = db.get(Project, project.id)
                assert p is not None
                result = import_lines(
                    db,
                    p,
                    payload.split,
                    as_json_lines(
                        stream_dataset(
                            payload.repository_id, payload.config, payload.split, payload.revision
                        )
                    ),
                    job,
                )
                job.status = "completed"
                job.progress = 1
                job.message = "Import complete"
                job.result = {
                    "project_id": p.id,
                    "split_id": result.id,
                    "records": result.record_count,
                }
        except Exception as exc:
            job.status = "failed"
            job.error = {"code": "HF_IMPORT_ERROR", "message": str(exc)}

    threading.Thread(target=work, daemon=True).start()
    return {"job_id": job.id, "project_id": project.id}


@api_router.get("/jobs/{job_id}")
def job_status(job_id: str) -> dict[str, Any]:
    value = jobs.public(job_id)
    if value is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Job not found"})
    return value


@api_router.post("/export/path")
def path_export(payload: ExportPath, session: DB) -> dict[str, Any]:
    get_or_404(session, Split, payload.split_id)
    try:
        count = export_to_path(session, payload.split_id, Path(payload.path), payload.overwrite)
    except FileExistsError as exc:
        raise HTTPException(
            409,
            detail={
                "code": "FILE_EXISTS",
                "message": "Target already exists",
                "details": {"path": str(exc)},
            },
        ) from exc
    return {"path": str(Path(payload.path).expanduser().resolve()), "records": count}


@api_router.get("/export/download")
def download_export(split_id: int, session: DB) -> StreamingResponse:
    split = get_or_404(session, Split, split_id)
    filename = f"{split.name}_edited.jsonl"
    return StreamingResponse(
        export_lines(session, split_id),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/projects/{project_id}/export.zip")
def download_zip(project_id: int, session: DB) -> StreamingResponse:
    project = get_or_404(session, Project, project_id)
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for split in project.splits:
            archive.writestr(f"{split.name}.jsonl", b"".join(export_lines(session, split.id)))
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{project.name}_edited.zip"'},
    )
