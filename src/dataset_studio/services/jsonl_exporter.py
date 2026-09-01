from __future__ import annotations

import json
import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from dataset_studio.db.models import Record


def export_lines(session: Session, split_id: int) -> Iterator[bytes]:
    statement = (
        select(Record)
        .where(Record.split_id == split_id, Record.is_deleted.is_(False))
        .order_by(Record.position, Record.id)
    )
    for record in session.scalars(statement).yield_per(1000):
        yield (
            json.dumps(record.current_json, ensure_ascii=False, separators=(",", ":")) + "\n"
        ).encode()


def export_to_path(session: Session, split_id: int, target: Path, overwrite: bool = False) -> int:
    target = target.expanduser().resolve()
    if target.exists() and not overwrite:
        raise FileExistsError(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{target.name}.", dir=target.parent)
    count = 0
    try:
        with os.fdopen(descriptor, "wb") as handle:
            for line in export_lines(session, split_id):
                handle.write(line)
                count += 1
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, target)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise
    return count
