from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps.auth import require_roles
from app.db.models import TestAttempt, User, UserRole
from app.db.session import get_db_session
from app.schemas.student import StudentHistoryItem, StudentHistoryResponse, StudentHistorySummary

router = APIRouter(prefix="/student", tags=["student"])


def _calculate_trend(scores: list[float]) -> str:
    if len(scores) < 3:
        return "stable"
    recent = scores[:3]
    if recent[0] - recent[-1] >= 8:
        return "up"
    if recent[-1] - recent[0] >= 8:
        return "down"
    return "stable"


@router.get("/history", response_model=StudentHistoryResponse)
async def history(current_user: User = Depends(require_roles(UserRole.STUDENT))) -> StudentHistoryResponse:
    async with get_db_session() as session:
        attempts = (
            await session.execute(
                select(TestAttempt)
                .where(TestAttempt.user_id == current_user.id, TestAttempt.finished_at.is_not(None))
                .options(selectinload(TestAttempt.test))
                .order_by(TestAttempt.finished_at.desc())
            )
        ).scalars().all()

    score_values = [float(attempt.score_percent or Decimal("0")) for attempt in attempts]
    average_score = round(sum(score_values) / len(score_values), 2) if score_values else 0.0
    best_score = round(max(score_values), 2) if score_values else 0.0
    trend = _calculate_trend(score_values)

    items = [
        StudentHistoryItem(
            attempt_id=attempt.id,
            test_type=attempt.test.type,
            started_at=attempt.started_at,
            finished_at=attempt.finished_at,
            score_percent=float(attempt.score_percent or Decimal("0")),
            level_result=attempt.level_result or "Beginner",
            theta_final=float(attempt.theta_final or Decimal("0")),
        )
        for attempt in attempts
        if attempt.finished_at is not None
    ]

    return StudentHistoryResponse(
        summary=StudentHistorySummary(
            total_attempts=len(items),
            average_score=average_score,
            best_score=best_score,
            trend=trend,
        ),
        attempts=items,
    )
