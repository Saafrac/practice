from __future__ import annotations

import math
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Answer, Question

THETA_MIN = Decimal("-2.00")
THETA_MAX = Decimal("2.00")
ADAPTIVE_QUESTION_LIMIT = 12


def clamp_theta(value: Decimal) -> Decimal:
    return min(max(value, THETA_MIN), THETA_MAX)


def update_theta_adaptive(theta_before: Decimal, question_difficulty: int, is_correct: bool) -> Decimal:
    b = Decimal(question_difficulty)
    theta_float = float(theta_before)
    b_float = float(b)

    # Rasch-like expected success probability.
    probability_correct = 1.0 / (1.0 + math.exp(-(theta_float - b_float)))
    distance = abs(theta_float - b_float)
    learning_rate = min(0.22 + distance * 0.07, 0.45)

    if is_correct:
        delta = learning_rate * (1.0 - probability_correct)
    else:
        delta = -learning_rate * probability_correct

    theta_after = theta_before + Decimal(str(delta))
    return clamp_theta(theta_after.quantize(Decimal("0.01")))


async def choose_next_adaptive_question(
    session: AsyncSession,
    attempt_id: int,
    theta: Decimal,
    answered_question_ids: set[int],
) -> Question | None:
    query = select(Question).options(selectinload(Question.options)).order_by(Question.id.asc())
    if answered_question_ids:
        query = query.where(~Question.id.in_(answered_question_ids))
    questions = (await session.execute(query)).scalars().all()

    if not questions:
        return None

    topic_counts: dict[str, int] = {}
    if answered_question_ids:
        answered_rows = (
            await session.execute(
                select(Question.topic)
                .join(Answer, Answer.question_id == Question.id)
                .where(Answer.attempt_id == attempt_id)
            )
        ).scalars().all()
        for topic in answered_rows:
            topic_counts[topic] = topic_counts.get(topic, 0) + 1

    theta_float = float(theta)
    best_question: Question | None = None
    best_score: float | None = None

    for question in questions:
        b_float = float(question.difficulty)
        distance = abs(theta_float - b_float)
        topic_penalty = topic_counts.get(question.topic, 0) * 0.35
        tie_breaker = question.id * 0.0001
        score = distance + topic_penalty + tie_breaker

        if best_score is None or score < best_score:
            best_score = score
            best_question = question

    return best_question
