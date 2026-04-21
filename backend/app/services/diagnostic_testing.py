from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Answer,
    ErrorProfile,
    Option,
    Question,
    Recommendation,
    Test,
    TestAttempt,
    TestType,
    User,
    UserRole,
)
from app.services.adaptive_engine import ADAPTIVE_QUESTION_LIMIT, choose_next_adaptive_question, update_theta_adaptive

THETA_STEP_DIAGNOSTIC = Decimal("0.20")
DIAGNOSTIC_QUESTION_LIMIT = 12


@dataclass(frozen=True)
class AttemptResultSnapshot:
    total_questions: int
    correct_answers: int
    score_percent: Decimal
    level_result: str


@dataclass(frozen=True)
class AttemptFeedbackSnapshot:
    weak_topics: list[str]
    recommendations: list[str]
    insight: str


def classify_level(score_percent: Decimal) -> str:
    if score_percent < Decimal("40"):
        return "Beginner"
    if score_percent < Decimal("55"):
        return "Elementary"
    if score_percent < Decimal("75"):
        return "Pre-Intermediate"
    return "Intermediate"


def build_topic_recommendation(topic: str) -> str:
    templates = {
        "grammar": "Review key grammar structures and complete 10 mixed grammar exercises.",
        "vocabulary": "Practice topic-based vocabulary with spaced repetition flashcards.",
        "reading": "Read short A2/B1 texts daily and summarize each paragraph in one sentence.",
        "articles": "Repeat rules for a/an/the and solve focused article drills.",
        "tenses": "Revise tense timeline usage with contrast exercises (Past vs Present Perfect).",
        "prepositions": "Practice common preposition collocations in sentence transformation tasks.",
        "word_order": "Train sentence-building patterns with adverb and inversion exercises.",
    }
    return templates.get(topic, f"Strengthen '{topic}' with targeted exercises and short daily practice.")


def build_insight(score_percent: Decimal, weak_topics: list[str]) -> str:
    if not weak_topics:
        if score_percent >= Decimal("75"):
            return "Strong and consistent performance across topics. Keep current pace."
        return "Balanced profile with no critical weak topics. Focus on speed and accuracy."

    joined_topics = ", ".join(weak_topics[:3])
    if score_percent < Decimal("55"):
        return f"Core gaps detected in {joined_topics}. Prioritize fundamentals before harder tasks."
    return f"Main growth area: {joined_topics}. Targeted practice should quickly improve your score."


def get_question_limit(test_type: TestType) -> int:
    if test_type == TestType.ADAPTIVE:
        return ADAPTIVE_QUESTION_LIMIT
    return DIAGNOSTIC_QUESTION_LIMIT


async def _get_test_by_type(session: AsyncSession, test_type: TestType) -> Test:
    test = await session.scalar(select(Test).where(Test.type == test_type, Test.is_active.is_(True)).limit(1))
    if test is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{test_type.value.title()} test is not configured.",
        )
    return test


async def start_test_attempt(session: AsyncSession, user: User, test_type: TestType) -> TestAttempt:
    if user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can start tests.",
        )

    test = await _get_test_by_type(session, test_type)
    attempt = TestAttempt(user_id=user.id, test_id=test.id)
    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)
    return attempt


async def get_attempt_for_user(session: AsyncSession, attempt_id: int, user: User) -> TestAttempt:
    attempt = await session.scalar(
        select(TestAttempt).where(TestAttempt.id == attempt_id).options(selectinload(TestAttempt.test))
    )
    if attempt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found.")

    if user.role != UserRole.ADMIN and attempt.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this attempt.",
        )

    return attempt


async def get_answered_question_ids(session: AsyncSession, attempt_id: int) -> set[int]:
    answered = (await session.execute(select(Answer.question_id).where(Answer.attempt_id == attempt_id))).scalars().all()
    return set(answered)


async def get_last_theta(session: AsyncSession, attempt_id: int) -> Decimal:
    last_theta = await session.scalar(
        select(Answer.theta_after).where(Answer.attempt_id == attempt_id).order_by(Answer.id.desc()).limit(1)
    )
    if last_theta is None:
        return Decimal("0.00")
    return Decimal(last_theta)


async def load_diagnostic_pool(session: AsyncSession) -> list[Question]:
    rows = (
        await session.execute(
            select(Question).options(selectinload(Question.options)).order_by(Question.difficulty.asc(), Question.id.asc())
        )
    ).scalars().all()

    if len(rows) < DIAGNOSTIC_QUESTION_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Question bank is not seeded enough for diagnostic flow.",
        )

    by_topic: dict[str, list[Question]] = {}
    for question in rows:
        by_topic.setdefault(question.topic, []).append(question)

    topic_names = sorted(by_topic.keys())
    selected: list[Question] = []
    topic_index = 0
    while len(selected) < DIAGNOSTIC_QUESTION_LIMIT:
        current_topic = topic_names[topic_index % len(topic_names)]
        topic_bucket = by_topic[current_topic]
        if topic_bucket:
            selected.append(topic_bucket.pop(0))
        topic_index += 1

    return selected


async def get_next_question_for_attempt(
    session: AsyncSession,
    attempt: TestAttempt,
    answered_question_ids: set[int],
) -> Question | None:
    if attempt.test.type == TestType.DIAGNOSTIC:
        pool = await load_diagnostic_pool(session)
        return next((item for item in pool if item.id not in answered_question_ids), None)

    if attempt.test.type == TestType.ADAPTIVE:
        theta = await get_last_theta(session, attempt.id)
        return await choose_next_adaptive_question(session, attempt.id, theta, answered_question_ids)

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported test type.")


async def submit_test_answer(
    session: AsyncSession,
    attempt: TestAttempt,
    question_id: int,
    selected_option_id: int,
) -> tuple[Answer, int]:
    if attempt.finished_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attempt is already finished.",
        )

    answered_questions = await get_answered_question_ids(session, attempt.id)
    if question_id in answered_questions:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This question is already answered.",
        )

    option = await session.scalar(select(Option).where(Option.id == selected_option_id, Option.question_id == question_id))
    if option is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected option does not belong to this question.",
        )

    question = await session.scalar(select(Question).where(Question.id == question_id))
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")

    theta_before = await get_last_theta(session, attempt.id)
    if attempt.test.type == TestType.ADAPTIVE:
        theta_after = update_theta_adaptive(theta_before, question.difficulty, option.is_correct)
    else:
        delta = THETA_STEP_DIAGNOSTIC if option.is_correct else -THETA_STEP_DIAGNOSTIC
        theta_after = (theta_before + delta).quantize(Decimal("0.01"))
        theta_after = max(min(theta_after, Decimal("2.00")), Decimal("-2.00"))

    answer = Answer(
        attempt_id=attempt.id,
        question_id=question_id,
        selected_option_id=selected_option_id,
        is_correct=option.is_correct,
        theta_before=theta_before,
        theta_after=theta_after,
    )
    session.add(answer)
    await session.commit()
    await session.refresh(answer)

    return answer, len(answered_questions) + 1


async def finalize_attempt_if_needed(session: AsyncSession, attempt: TestAttempt) -> AttemptResultSnapshot | None:
    if attempt.finished_at is not None:
        return await build_attempt_result(session, attempt.id)

    answers = (
        await session.execute(select(Answer).where(Answer.attempt_id == attempt.id).order_by(Answer.id.asc()))
    ).scalars().all()
    question_limit = get_question_limit(attempt.test.type)
    if len(answers) < question_limit:
        return None

    total_questions = len(answers)
    correct_answers = sum(1 for answer in answers if answer.is_correct)
    score_percent = (Decimal(correct_answers) / Decimal(total_questions) * Decimal("100")).quantize(Decimal("0.01"))
    level_result = classify_level(score_percent)
    theta_final = Decimal(answers[-1].theta_after or Decimal("0.00")).quantize(Decimal("0.01"))

    attempt.finished_at = datetime.now(timezone.utc)
    attempt.score_percent = score_percent
    attempt.level_result = level_result
    attempt.theta_final = theta_final
    await session.commit()
    await rebuild_error_profile_and_recommendations(session, attempt.id, score_percent)

    return AttemptResultSnapshot(
        total_questions=total_questions,
        correct_answers=correct_answers,
        score_percent=score_percent,
        level_result=level_result,
    )


async def build_attempt_result(session: AsyncSession, attempt_id: int) -> AttemptResultSnapshot:
    answers = (
        await session.execute(select(Answer).where(Answer.attempt_id == attempt_id).order_by(Answer.id.asc()))
    ).scalars().all()
    total_questions = len(answers)
    correct_answers = sum(1 for answer in answers if answer.is_correct)

    if total_questions == 0:
        score_percent = Decimal("0.00")
        level_result = "Beginner"
    else:
        score_percent = (Decimal(correct_answers) / Decimal(total_questions) * Decimal("100")).quantize(Decimal("0.01"))
        level_result = classify_level(score_percent)

    return AttemptResultSnapshot(
        total_questions=total_questions,
        correct_answers=correct_answers,
        score_percent=score_percent,
        level_result=level_result,
    )


async def rebuild_error_profile_and_recommendations(
    session: AsyncSession,
    attempt_id: int,
    score_percent: Decimal,
) -> AttemptFeedbackSnapshot:
    answers = (
        await session.execute(
            select(Answer)
            .where(Answer.attempt_id == attempt_id)
            .options(selectinload(Answer.question))
            .order_by(Answer.id.asc())
        )
    ).scalars().all()

    topic_stats: dict[str, dict[str, int]] = {}
    for answer in answers:
        topic = answer.question.topic
        bucket = topic_stats.setdefault(topic, {"total": 0, "wrong": 0})
        bucket["total"] += 1
        if not answer.is_correct:
            bucket["wrong"] += 1

    await session.execute(delete(ErrorProfile).where(ErrorProfile.attempt_id == attempt_id))
    await session.execute(delete(Recommendation).where(Recommendation.attempt_id == attempt_id))

    for topic, bucket in topic_stats.items():
        total = bucket["total"]
        wrong = bucket["wrong"]
        accuracy = Decimal("0.00")
        if total > 0:
            accuracy = (Decimal(total - wrong) / Decimal(total) * Decimal("100")).quantize(Decimal("0.01"))

        session.add(
            ErrorProfile(
                attempt_id=attempt_id,
                topic=topic,
                total_questions=total,
                wrong_answers=wrong,
                accuracy_percent=accuracy,
            )
        )

    weak_topics = [
        topic
        for topic, bucket in sorted(topic_stats.items(), key=lambda item: (-item[1]["wrong"], item[0]))
        if bucket["wrong"] >= 2 or (bucket["total"] >= 2 and (bucket["wrong"] / max(bucket["total"], 1)) >= 0.4)
    ]
    if not weak_topics:
        weak_topics = [
            topic
            for topic, bucket in sorted(topic_stats.items(), key=lambda item: (-item[1]["wrong"], item[0]))
            if bucket["wrong"] > 0
        ][:1]

    recommendations: list[str] = []
    for topic in weak_topics[:3]:
        recommendation_text = build_topic_recommendation(topic)
        recommendations.append(recommendation_text)
        session.add(
            Recommendation(
                attempt_id=attempt_id,
                category=topic,
                text=recommendation_text,
            )
        )

    insight = build_insight(score_percent, weak_topics)
    await session.commit()
    return AttemptFeedbackSnapshot(
        weak_topics=weak_topics,
        recommendations=recommendations,
        insight=insight,
    )


async def get_attempt_feedback(session: AsyncSession, attempt_id: int, score_percent: Decimal) -> AttemptFeedbackSnapshot:
    weak_topics = (
        await session.execute(
            select(ErrorProfile.topic)
            .where(ErrorProfile.attempt_id == attempt_id, ErrorProfile.wrong_answers > 0)
            .order_by(ErrorProfile.wrong_answers.desc(), ErrorProfile.topic.asc())
        )
    ).scalars().all()
    recommendations = (
        await session.execute(
            select(Recommendation.text)
            .where(Recommendation.attempt_id == attempt_id)
            .order_by(Recommendation.id.asc())
        )
    ).scalars().all()

    if not weak_topics and not recommendations:
        return await rebuild_error_profile_and_recommendations(session, attempt_id, score_percent)

    return AttemptFeedbackSnapshot(
        weak_topics=list(weak_topics),
        recommendations=list(recommendations),
        insight=build_insight(score_percent, list(weak_topics)),
    )
