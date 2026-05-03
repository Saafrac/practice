from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.db.models import TestType


class TeacherStudentItem(BaseModel):
    id: int
    full_name: str
    email: str
    attempts_count: int
    average_score: float
    last_level: str | None


class TeacherStudentsResponse(BaseModel):
    students: list[TeacherStudentItem]


class TeacherStudentResultItem(BaseModel):
    attempt_id: int
    test_type: TestType
    finished_at: datetime
    score_percent: float
    level_result: str
    theta_final: float


class TeacherStudentResultsResponse(BaseModel):
    student_id: int
    student_name: str
    results: list[TeacherStudentResultItem]


class TeacherWeakTopicItem(BaseModel):
    topic: str
    total_questions: int
    wrong_answers: int
    accuracy_percent: float


class TeacherGroupAnalyticsResponse(BaseModel):
    students_count: int
    total_attempts: int
    average_score: float
    weak_topics: list[TeacherWeakTopicItem]


class TeacherStudentReportResponse(BaseModel):
    student_id: int
    student_name: str
    latest_attempt: TeacherStudentResultItem | None
    weak_topics: list[TeacherWeakTopicItem]
    recommendations: list[str]
