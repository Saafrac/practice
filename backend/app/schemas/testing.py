from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import TestType


class TestAttemptStartResponse(BaseModel):
    attempt_id: int
    test_id: int
    test_title: str
    test_type: TestType
    max_questions: int


class QuestionOptionPublic(BaseModel):
    id: int
    text: str

    model_config = ConfigDict(from_attributes=True)


class NextQuestionPayload(BaseModel):
    id: int
    text: str
    topic: str
    difficulty: int
    options: list[QuestionOptionPublic]


class NextQuestionResponse(BaseModel):
    attempt_id: int
    test_type: TestType
    answered_questions: int
    max_questions: int
    is_finished: bool
    current_theta: float
    question: NextQuestionPayload | None = None


class SubmitAnswerRequest(BaseModel):
    question_id: int = Field(gt=0)
    selected_option_id: int = Field(gt=0)


class SubmitAnswerResponse(BaseModel):
    attempt_id: int
    test_type: TestType
    is_correct: bool
    answered_questions: int
    max_questions: int
    is_finished: bool
    theta_before: float
    theta_after: float


class ErrorProfileItem(BaseModel):
    topic: str
    total_questions: int
    wrong_answers: int
    accuracy_percent: float


class AttemptResultResponse(BaseModel):
    attempt_id: int
    started_at: datetime
    finished_at: datetime
    score_percent: float
    level_result: str
    theta_final: float
    total_questions: int
    correct_answers: int
    insight: str
    weak_topics: list[str]
    recommendations: list[str]
    error_profile: list[ErrorProfileItem] = Field(default_factory=list)

