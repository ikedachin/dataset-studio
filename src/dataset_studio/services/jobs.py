from __future__ import annotations

import threading
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Job:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "queued"
    processed: int = 0
    total: int | None = None
    progress: float | None = None
    message: str = "Waiting"
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def create(self) -> Job:
        job = Job()
        with self._lock:
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def public(self, job_id: str) -> dict[str, Any] | None:
        job = self.get(job_id)
        return asdict(job) if job else None


jobs = JobStore()
