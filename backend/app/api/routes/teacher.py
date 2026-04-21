from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps.auth import require_roles
from app.db.models import ErrorProfile, Group, StudentGroup, TestAttempt, User, UserRole
from app.db.session import get_db_session
from app.schemas.teacher import (
    TeacherGroupAnalyticsResponse,
    TeacherStudentItem,
    TeacherStudentResultItem,
    TeacherStudentResultsResponse,
    TeacherStudentsResponse,
    TeacherWeakTopicItem,
)

router = APIRouter(prefix="/teacher", tags=["teacher"])


async def _resolve_student_ids(session: AsyncSession, current_user: User) -> set[int]:
    if current_user.role == UserRole.ADMIN:
        rows = (await session.execute(select(User.id).where(User.role == UserRole.STUDENT))).scalars().all()
        return set(rows)

    group_ids = (
        await session.execute(select(Group.id).where(Group.teacher_id == current_user.id))
    ).scalars().all()
    if not group_ids:
        return set()

    student_ids = (
        await session.execute(select(StudentGroup.student_id).where(StudentGroup.group_id.in_(group_ids)))
    ).scalars().all()
    return set(student_ids)


@router.get("/students", response_model=TeacherStudentsResponse)
async def students(
    current_user: User = Depends(require_roles(UserRole.TEACHER, UserRole.ADMIN)),
) -> TeacherStudentsResponse:
    async with get_db_session() as session:
        student_ids = await _resolve_student_ids(session, current_user)
        if not student_ids:
            return TeacherStudentsResponse(students=[])

        student_rows = (
            await session.execute(select(User).where(User.id.in_(student_ids)).order_by(User.full_name.asc()))
        ).scalars().all()
        attempts = (
            await session.execute(
                select(TestAttempt)
                .where(TestAttempt.user_id.in_(student_ids), TestAttempt.finished_at.is_not(None))
                .order_by(TestAttempt.finished_at.desc())
            )
        ).scalars().all()

    attempt_map: dict[int, list[TestAttempt]] = {}
    for attempt in attempts:
        attempt_map.setdefault(attempt.user_id, []).append(attempt)

    response_items: list[TeacherStudentItem] = []
    for student in student_rows:
        student_attempts = attempt_map.get(student.id, [])
        scores = [float(a.score_percent or Decimal("0")) for a in student_attempts]
        average_score = round(sum(scores) / len(scores), 2) if scores else 0.0
        last_level = student_attempts[0].level_result if student_attempts else None
        response_items.append(
            TeacherStudentItem(
                id=student.id,
                full_name=student.full_name,
                email=student.email,
                attempts_count=len(student_attempts),
                average_score=average_score,
                last_level=last_level,
            )
        )

    return TeacherStudentsResponse(students=response_items)


@router.get("/students/{student_id}/results", response_model=TeacherStudentResultsResponse)
async def student_results(
    student_id: int,
    current_user: User = Depends(require_roles(UserRole.TEACHER, UserRole.ADMIN)),
) -> TeacherStudentResultsResponse:
    async with get_db_session() as session:
        student_ids = await _resolve_student_ids(session, current_user)
        if student_id not in student_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Student is not in your groups.",
            )

        student = await session.scalar(select(User).where(User.id == student_id, User.role == UserRole.STUDENT))
        if student is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

        attempts = (
            await session.execute(
                select(TestAttempt)
                .where(TestAttempt.user_id == student_id, TestAttempt.finished_at.is_not(None))
                .options(selectinload(TestAttempt.test))
                .order_by(TestAttempt.finished_at.desc())
            )
        ).scalars().all()

    return TeacherStudentResultsResponse(
        student_id=student.id,
        student_name=student.full_name,
        results=[
            TeacherStudentResultItem(
                attempt_id=attempt.id,
                test_type=attempt.test.type,
                finished_at=attempt.finished_at,
                score_percent=float(attempt.score_percent or Decimal("0")),
                level_result=attempt.level_result or "Beginner",
                theta_final=float(attempt.theta_final or Decimal("0")),
            )
            for attempt in attempts
            if attempt.finished_at is not None
        ],
    )


@router.get("/group-analytics", response_model=TeacherGroupAnalyticsResponse)
async def group_analytics(
    current_user: User = Depends(require_roles(UserRole.TEACHER, UserRole.ADMIN)),
) -> TeacherGroupAnalyticsResponse:
    async with get_db_session() as session:
        student_ids = await _resolve_student_ids(session, current_user)
        if not student_ids:
            return TeacherGroupAnalyticsResponse(
                students_count=0,
                total_attempts=0,
                average_score=0.0,
                weak_topics=[],
            )

        attempts = (
            await session.execute(
                select(TestAttempt).where(
                    TestAttempt.user_id.in_(student_ids),
                    TestAttempt.finished_at.is_not(None),
                )
            )
        ).scalars().all()

        attempt_ids = [attempt.id for attempt in attempts]
        error_profiles = []
        if attempt_ids:
            error_profiles = (
                await session.execute(select(ErrorProfile).where(ErrorProfile.attempt_id.in_(attempt_ids)))
            ).scalars().all()

    scores = [float(attempt.score_percent or Decimal("0")) for attempt in attempts]
    average_score = round(sum(scores) / len(scores), 2) if scores else 0.0

    topic_agg: dict[str, dict[str, Decimal | int]] = {}
    for item in error_profiles:
        bucket = topic_agg.setdefault(
            item.topic,
            {"total_questions": 0, "wrong_answers": 0},
        )
        bucket["total_questions"] = int(bucket["total_questions"]) + int(item.total_questions)
        bucket["wrong_answers"] = int(bucket["wrong_answers"]) + int(item.wrong_answers)

    weak_topics: list[TeacherWeakTopicItem] = []
    for topic, data in topic_agg.items():
        total_questions = int(data["total_questions"])
        wrong_answers = int(data["wrong_answers"])
        accuracy_percent = 0.0
        if total_questions > 0:
            accuracy_percent = round(((total_questions - wrong_answers) / total_questions) * 100, 2)
        weak_topics.append(
            TeacherWeakTopicItem(
                topic=topic,
                total_questions=total_questions,
                wrong_answers=wrong_answers,
                accuracy_percent=accuracy_percent,
            )
        )

    weak_topics.sort(key=lambda x: (-x.wrong_answers, x.topic))

    return TeacherGroupAnalyticsResponse(
        students_count=len(student_ids),
        total_attempts=len(attempts),
        average_score=average_score,
        weak_topics=weak_topics[:5],
    )
