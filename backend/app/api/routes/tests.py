from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from app.api.deps.auth import get_current_user
from app.db.models import Answer, ErrorProfile, TestType, User
from app.db.session import get_db_session
from app.schemas.testing import (
    AttemptResultResponse,
    ErrorProfileItem,
    NextQuestionPayload,
    NextQuestionResponse,
    QuestionOptionPublic,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    TestAttemptStartResponse,
)
from app.services.diagnostic_testing import (
    get_attempt_feedback,
    get_answered_question_ids,
    get_attempt_for_user,
    get_last_theta,
    get_next_question_for_attempt,
    get_question_limit,
    start_test_attempt,
    submit_test_answer,
    finalize_attempt_if_needed,
)

router = APIRouter(prefix="/tests", tags=["tests"])


async def _start_attempt_by_type(test_type: TestType, current_user: User) -> TestAttemptStartResponse:
    async with get_db_session() as session:
        attempt = await start_test_attempt(session, current_user, test_type)
        attempt = await get_attempt_for_user(session, attempt.id, current_user)

    return TestAttemptStartResponse(
        attempt_id=attempt.id,
        test_id=attempt.test_id,
        test_title=attempt.test.title,
        test_type=attempt.test.type,
        max_questions=get_question_limit(attempt.test.type),
    )


@router.post("/diagnostic/start", response_model=TestAttemptStartResponse, status_code=status.HTTP_201_CREATED)
async def start_diagnostic(current_user: User = Depends(get_current_user)) -> TestAttemptStartResponse:
    return await _start_attempt_by_type(TestType.DIAGNOSTIC, current_user)


@router.post("/adaptive/start", response_model=TestAttemptStartResponse, status_code=status.HTTP_201_CREATED)
async def start_adaptive(current_user: User = Depends(get_current_user)) -> TestAttemptStartResponse:
    return await _start_attempt_by_type(TestType.ADAPTIVE, current_user)


@router.get("/{attempt_id}/next-question", response_model=NextQuestionResponse)
async def next_question(attempt_id: int, current_user: User = Depends(get_current_user)) -> NextQuestionResponse:
    async with get_db_session() as session:
        attempt = await get_attempt_for_user(session, attempt_id, current_user)
        answered_question_ids = await get_answered_question_ids(session, attempt.id)
        current_theta = await get_last_theta(session, attempt.id)
        max_questions = get_question_limit(attempt.test.type)

        if attempt.finished_at is not None:
            return NextQuestionResponse(
                attempt_id=attempt.id,
                test_type=attempt.test.type,
                answered_questions=len(answered_question_ids),
                max_questions=max_questions,
                is_finished=True,
                current_theta=float(current_theta),
                question=None,
            )

        next_item = await get_next_question_for_attempt(session, attempt, answered_question_ids)
        if next_item is None:
            await finalize_attempt_if_needed(session, attempt)
            return NextQuestionResponse(
                attempt_id=attempt.id,
                test_type=attempt.test.type,
                answered_questions=len(answered_question_ids),
                max_questions=max_questions,
                is_finished=True,
                current_theta=float(current_theta),
                question=None,
            )

        return NextQuestionResponse(
            attempt_id=attempt.id,
            test_type=attempt.test.type,
            answered_questions=len(answered_question_ids),
            max_questions=max_questions,
            is_finished=False,
            current_theta=float(current_theta),
            question=NextQuestionPayload(
                id=next_item.id,
                text=next_item.text,
                topic=next_item.topic,
                difficulty=next_item.difficulty,
                options=[QuestionOptionPublic.model_validate(option) for option in next_item.options],
            ),
        )


@router.post("/{attempt_id}/answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    attempt_id: int,
    payload: SubmitAnswerRequest,
    current_user: User = Depends(get_current_user),
) -> SubmitAnswerResponse:
    async with get_db_session() as session:
        attempt = await get_attempt_for_user(session, attempt_id, current_user)
        expected_next = await get_next_question_for_attempt(
            session,
            attempt,
            await get_answered_question_ids(session, attempt.id),
        )
        if expected_next is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Attempt is already complete.",
            )
        if payload.question_id != expected_next.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Answer does not match current question.",
            )

        answer, answered_questions = await submit_test_answer(
            session,
            attempt,
            question_id=payload.question_id,
            selected_option_id=payload.selected_option_id,
        )
        snapshot = await finalize_attempt_if_needed(session, attempt)

    return SubmitAnswerResponse(
        attempt_id=attempt_id,
        test_type=attempt.test.type,
        is_correct=answer.is_correct,
        answered_questions=answered_questions,
        max_questions=get_question_limit(attempt.test.type),
        is_finished=snapshot is not None,
        theta_before=float(answer.theta_before or Decimal("0")),
        theta_after=float(answer.theta_after or Decimal("0")),
    )


@router.get("/{attempt_id}/result", response_model=AttemptResultResponse)
async def attempt_result(attempt_id: int, current_user: User = Depends(get_current_user)) -> AttemptResultResponse:
    async with get_db_session() as session:
        attempt = await get_attempt_for_user(session, attempt_id, current_user)
        if attempt.finished_at is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Attempt is still in progress.",
            )

        answered_question_ids = await get_answered_question_ids(session, attempt.id)
        correct_answers = await session.scalar(
            select(func.count(Answer.id)).where(Answer.attempt_id == attempt.id, Answer.is_correct.is_(True))
        )
        feedback = await get_attempt_feedback(session, attempt.id, Decimal(attempt.score_percent or Decimal("0")))
        error_profile_rows = (
            await session.execute(
                select(ErrorProfile)
                .where(ErrorProfile.attempt_id == attempt.id)
                .order_by(ErrorProfile.wrong_answers.desc(), ErrorProfile.topic.asc())
            )
        ).scalars().all()

    total_questions = len(answered_question_ids)
    correct_total = int(correct_answers or 0)

    return AttemptResultResponse(
        attempt_id=attempt.id,
        started_at=attempt.started_at,
        finished_at=attempt.finished_at,
        score_percent=float(attempt.score_percent or Decimal("0")),
        level_result=attempt.level_result or "Beginner",
        theta_final=float(attempt.theta_final or Decimal("0")),
        total_questions=total_questions,
        correct_answers=correct_total,
        insight=feedback.insight,
        weak_topics=feedback.weak_topics,
        recommendations=feedback.recommendations,
        error_profile=[
            ErrorProfileItem(
                topic=item.topic,
                total_questions=item.total_questions,
                wrong_answers=item.wrong_answers,
                accuracy_percent=float(item.accuracy_percent),
            )
            for item in error_profile_rows
        ],
    )
