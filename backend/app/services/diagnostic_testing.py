from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from urllib import error as urllib_error
from urllib import request as urllib_request

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
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
class RecommendationCardSnapshot:
    category: str
    reason: str
    suggested_activity: str
    estimated_time: str
    priority: str
    source: str = "Rule-based"


@dataclass(frozen=True)
class AttemptFeedbackSnapshot:
    weak_topics: list[str]
    recommendations: list[str]
    insight: str
    recommendation_cards: list[RecommendationCardSnapshot] = field(default_factory=list)


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


def build_ai_recommendation_card(
    topic: str,
    recommendation_text: str,
    total_questions: int,
    wrong_answers: int,
    score_percent: Decimal,
) -> RecommendationCardSnapshot:
    activity_templates = {
        "grammar": "Complete a short grammar drill, then rewrite 5 incorrect sentences with explanations.",
        "vocabulary": "Create a 12-word flashcard set and review it twice using spaced repetition.",
        "reading": "Read one A2/B1 text and write a one-sentence summary for each paragraph.",
        "articles": "Solve focused a/an/the drills and explain the article choice after each answer.",
        "tenses": "Compare two tense timelines and complete contrast exercises for Past and Present Perfect.",
        "prepositions": "Practice 10 common collocations, then use each one in a sentence.",
        "word_order": "Build 8 sentences from shuffled words and check subject-verb-object order.",
    }

    accuracy = Decimal("100.00")
    if total_questions > 0:
        accuracy = (Decimal(total_questions - wrong_answers) / Decimal(total_questions) * Decimal("100")).quantize(
            Decimal("0.01")
        )

    if wrong_answers >= 2 or accuracy < Decimal("55") or score_percent < Decimal("55"):
        priority = "High"
        estimated_time = "25 min"
    elif wrong_answers == 1 or accuracy < Decimal("75"):
        priority = "Medium"
        estimated_time = "15 min"
    else:
        priority = "Low"
        estimated_time = "10 min"

    if wrong_answers > 0:
        reason = (
            f"{wrong_answers} mistake(s) in {topic} lowered accuracy to {accuracy}%. "
            "The module prioritizes this area from the error profile."
        )
    else:
        reason = "No critical gap was detected, so the module recommends light maintenance practice."

    return RecommendationCardSnapshot(
        category=topic,
        reason=reason,
        suggested_activity=activity_templates.get(topic, recommendation_text),
        estimated_time=estimated_time,
        priority=priority,
    )


def _extract_json_array(text: str) -> list[dict[str, str]]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Gemini response did not contain a JSON array.")

    parsed = json.loads(cleaned[start : end + 1])
    if not isinstance(parsed, list):
        raise ValueError("Gemini response JSON is not a list.")

    return [item for item in parsed if isinstance(item, dict)]


def _normalize_priority(priority: object) -> str:
    if isinstance(priority, str) and priority.strip().lower() in {"high", "medium", "low"}:
        return priority.strip().title()
    return "Medium"


def _safe_text(value: object, fallback: str, max_length: int = 260) -> str:
    if not isinstance(value, str):
        return fallback
    text = " ".join(value.split())
    if not text:
        return fallback
    return text[:max_length].rstrip()


def _request_gemini_recommendations(prompt: str, api_key: str, model: str, timeout_seconds: int) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.35,
            "responseMimeType": "application/json",
        },
    }
    request = urllib_request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )
    with urllib_request.urlopen(request, timeout=timeout_seconds) as response:
        response_payload = json.loads(response.read().decode("utf-8"))

    return response_payload["candidates"][0]["content"]["parts"][0]["text"]


async def maybe_enhance_recommendation_cards_with_llm(
    score_percent: Decimal,
    weak_topics: list[str],
    topic_stats: dict[str, dict[str, int]],
    recommendation_cards: list[RecommendationCardSnapshot],
) -> list[RecommendationCardSnapshot]:
    settings = get_settings()
    if not settings.gemini_api_key or not recommendation_cards:
        return recommendation_cards

    baseline_cards = [
        {
            "category": card.category,
            "priority": card.priority,
            "reason": card.reason,
            "suggested_activity": card.suggested_activity,
            "estimated_time": card.estimated_time,
            "stats": topic_stats.get(card.category, {"total": 0, "wrong": 0}),
        }
        for card in recommendation_cards
    ]
    prompt = (
        "You are an English-learning recommendation module inside a diagnostic testing app. "
        "Improve these recommendation cards using the student's score and error profile. "
        "Return ONLY a JSON array with the same number of items and these fields: "
        "category, priority, reason, suggested_activity, estimated_time. "
        "Use short, concrete learning actions. Keep priority as High, Medium, or Low. "
        "Do not mention that you are an AI model.\n\n"
        f"Score percent: {score_percent}\n"
        f"Weak topics: {weak_topics}\n"
        f"Baseline cards: {json.dumps(baseline_cards, ensure_ascii=False)}"
    )

    try:
        response_text = await asyncio.to_thread(
            _request_gemini_recommendations,
            prompt,
            settings.gemini_api_key,
            settings.gemini_model,
            settings.gemini_timeout_seconds,
        )
        llm_items = _extract_json_array(response_text)
    except (KeyError, ValueError, json.JSONDecodeError, TimeoutError, urllib_error.URLError, urllib_error.HTTPError):
        return recommendation_cards

    enhanced_cards: list[RecommendationCardSnapshot] = []
    for index, card in enumerate(recommendation_cards):
        item = llm_items[index] if index < len(llm_items) else {}
        enhanced_cards.append(
            RecommendationCardSnapshot(
                category=card.category,
                priority=_normalize_priority(item.get("priority", card.priority)),
                reason=_safe_text(item.get("reason"), card.reason),
                suggested_activity=_safe_text(item.get("suggested_activity"), card.suggested_activity),
                estimated_time=_safe_text(item.get("estimated_time"), card.estimated_time, max_length=32),
                source="Gemini AI" if item else card.source,
            )
        )

    return enhanced_cards


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
    recommendation_cards: list[RecommendationCardSnapshot] = []
    for topic in weak_topics[:3]:
        recommendation_text = build_topic_recommendation(topic)
        bucket = topic_stats.get(topic, {"total": 0, "wrong": 0})
        recommendations.append(recommendation_text)
        recommendation_cards.append(
            build_ai_recommendation_card(
                topic=topic,
                recommendation_text=recommendation_text,
                total_questions=bucket["total"],
                wrong_answers=bucket["wrong"],
                score_percent=score_percent,
            )
        )
        session.add(
            Recommendation(
                attempt_id=attempt_id,
                category=topic,
                text=recommendation_text,
            )
        )

    if not recommendations:
        recommendation_text = "Keep regular mixed practice to maintain your current level."
        recommendations.append(recommendation_text)
        recommendation_cards.append(
            build_ai_recommendation_card(
                topic="mixed_practice",
                recommendation_text=recommendation_text,
                total_questions=len(answers),
                wrong_answers=0,
                score_percent=score_percent,
            )
        )
        session.add(
            Recommendation(
                attempt_id=attempt_id,
                category="mixed_practice",
                text=recommendation_text,
            )
        )

    await session.commit()
    insight = build_insight(score_percent, weak_topics)
    return AttemptFeedbackSnapshot(
        weak_topics=weak_topics,
        recommendations=recommendations,
        insight=insight,
        recommendation_cards=recommendation_cards,
    )


async def get_attempt_feedback(session: AsyncSession, attempt_id: int, score_percent: Decimal) -> AttemptFeedbackSnapshot:
    weak_topics = (
        await session.execute(
            select(ErrorProfile.topic)
            .where(ErrorProfile.attempt_id == attempt_id, ErrorProfile.wrong_answers > 0)
            .order_by(ErrorProfile.wrong_answers.desc(), ErrorProfile.topic.asc())
        )
    ).scalars().all()
    recommendation_rows = (
        await session.execute(
            select(Recommendation.category, Recommendation.text)
            .where(Recommendation.attempt_id == attempt_id)
            .order_by(Recommendation.id.asc())
        )
    ).all()

    if not recommendation_rows:
        return await rebuild_error_profile_and_recommendations(session, attempt_id, score_percent)

    error_profile_rows = (
        await session.execute(
            select(ErrorProfile)
            .where(ErrorProfile.attempt_id == attempt_id)
            .order_by(ErrorProfile.wrong_answers.desc(), ErrorProfile.topic.asc())
        )
    ).scalars().all()
    stats_by_topic = {
        item.topic: {"total": item.total_questions, "wrong": item.wrong_answers}
        for item in error_profile_rows
    }
    recommendations = [text for _, text in recommendation_rows]
    recommendation_cards = [
        build_ai_recommendation_card(
            topic=category,
            recommendation_text=text,
            total_questions=stats_by_topic.get(category, {"total": 0, "wrong": 0})["total"],
            wrong_answers=stats_by_topic.get(category, {"total": 0, "wrong": 0})["wrong"],
            score_percent=score_percent,
        )
        for category, text in recommendation_rows
    ]
    recommendation_cards = await maybe_enhance_recommendation_cards_with_llm(
        score_percent=score_percent,
        weak_topics=list(weak_topics),
        topic_stats=stats_by_topic,
        recommendation_cards=recommendation_cards,
    )

    return AttemptFeedbackSnapshot(
        weak_topics=list(weak_topics),
        recommendations=recommendations,
        insight=build_insight(score_percent, list(weak_topics)),
        recommendation_cards=recommendation_cards,
    )
