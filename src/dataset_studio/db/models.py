from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[str] = mapped_column(String(32))
    source_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    inferred_schema: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    sync_rules: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    required_fields: Mapped[list[str]] = mapped_column(JSON, default=list)
    identifier_field: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    splits: Mapped[list[Split]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class Split(Base):
    __tablename__ = "splits"
    __table_args__ = (Index("idx_splits_project_position", "project_id", "position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128), default="train")
    position: Mapped[int] = mapped_column(Integer, default=0)
    record_count: Mapped[int] = mapped_column(Integer, default=0)
    project: Mapped[Project] = relationship(back_populates="splits")
    records: Mapped[list[Record]] = relationship(
        back_populates="split", cascade="all, delete-orphan"
    )


class Record(Base):
    __tablename__ = "records"
    __table_args__ = (
        Index("idx_records_split_position", "split_id", "position"),
        Index("idx_records_split_status", "split_id", "status", "is_deleted"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    split_id: Mapped[int] = mapped_column(ForeignKey("splits.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    original_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    current_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    search_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="unedited")
    validation_status: Mapped[str] = mapped_column(String(32), default="valid")
    validation_issues: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    is_new: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    split: Mapped[Split] = relationship(back_populates="records")
