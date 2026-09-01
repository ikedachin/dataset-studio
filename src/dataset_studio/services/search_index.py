from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from dataset_studio.db.models import Record


def index_record(session: Session, record: Record) -> None:
    session.execute(text("DELETE FROM record_fts WHERE record_id = :id"), {"id": record.id})
    session.execute(
        text("INSERT INTO record_fts(record_id, search_text) VALUES (:id, :content)"),
        {"id": record.id, "content": record.search_text},
    )


def index_new_records(session: Session, records: list[Record]) -> None:
    if not records:
        return
    session.execute(
        text("INSERT INTO record_fts(record_id, search_text) VALUES (:id, :content)"),
        [{"id": record.id, "content": record.search_text} for record in records],
    )


def remove_record(session: Session, record_id: int) -> None:
    session.execute(text("DELETE FROM record_fts WHERE record_id = :id"), {"id": record_id})
