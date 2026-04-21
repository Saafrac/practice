from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.db.models import TestType


class StudentHistoryItem(BaseModel):
    attempt_id: int
    test_type: TestType
    started_at: datetime
    finished_at: datetime
    score_percent: float
    level_result: str
    theta_final: float


class StudentHistorySummary(BaseModel):
    total_attempts: int
    average_score: float
    best_score: float
    trend: str


class StudentHistoryResponse(BaseModel):
    summary: StudentHistorySummary
    attempts: list[StudentHistoryItem]
