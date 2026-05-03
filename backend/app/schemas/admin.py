from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import UserRole


class AdminUserItem(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUsersResponse(BaseModel):
    users: list[AdminUserItem]


class AdminUpdateUserRoleRequest(BaseModel):
    role: UserRole


class AdminQuestionOption(BaseModel):
    id: int
    text: str
    is_correct: bool


class AdminQuestionItem(BaseModel):
    id: int
    text: str
    question_type: str
    difficulty: int
    topic: str
    explanation: str | None
    created_at: datetime
    options: list[AdminQuestionOption]


class AdminQuestionsResponse(BaseModel):
    questions: list[AdminQuestionItem]


class AdminSystemStatusResponse(BaseModel):
    api_status: str
    database_status: str
    users_count: int
    questions_count: int
    active_tests_count: int
    last_seed_update: datetime | None


class AdminQuestionUpsertRequest(BaseModel):
    text: str = Field(min_length=5, max_length=4000)
    difficulty: int = Field(ge=-2, le=2)
    topic: str = Field(min_length=2, max_length=100)
    explanation: str | None = Field(default=None, max_length=4000)
    options: list[str] = Field(min_length=2, max_length=6)
    correct_index: int = Field(ge=0, le=5)
