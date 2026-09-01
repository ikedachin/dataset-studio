from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from dataset_studio.db.models import Base

_engine: Engine | None = None
_factory: sessionmaker[Session] | None = None


def configure_database(path: Path) -> Engine:
    global _engine, _factory
    path.parent.mkdir(parents=True, exist_ok=True)
    _engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})

    @event.listens_for(_engine, "connect")
    def set_pragmas(dbapi_connection: object, _: object) -> None:
        cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

    Base.metadata.create_all(_engine)
    with _engine.begin() as connection:
        connection.execute(
            text(
                "CREATE VIRTUAL TABLE IF NOT EXISTS record_fts "
                "USING fts5(record_id UNINDEXED, search_text, tokenize='unicode61')"
            )
        )
        connection.execute(text("PRAGMA optimize"))
    _factory = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


def get_session() -> Generator[Session, None, None]:
    if _factory is None:
        raise RuntimeError("Database has not been configured")
    with _factory() as session:
        yield session


def session_factory() -> sessionmaker[Session]:
    if _factory is None:
        raise RuntimeError("Database has not been configured")
    return _factory
