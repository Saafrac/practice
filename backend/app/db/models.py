from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(StrEnum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class TestType(StrEnum):
    DIAGNOSTIC = "diagnostic"
    ADAPTIVE = "adaptive"
    FINAL = "final"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum", native_enum=False, validate_strings=True),
        nullable=False,
        default=UserRole.STUDENT,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    taught_groups: Mapped[list["Group"]] = relationship(
        "Group",
        back_populates="teacher",
        foreign_keys="Group.teacher_id",
    )
    group_links: Mapped[list["StudentGroup"]] = relationship(
        "StudentGroup",
        back_populates="student",
        foreign_keys="StudentGroup.student_id",
    )
    attempts: Mapped[list["TestAttempt"]] = relationship("TestAttempt", back_populates="user")


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    teacher: Mapped["User"] = relationship(
        "User",
        back_populates="taught_groups",
        foreign_keys=[teacher_id],
    )
    students: Mapped[list["StudentGroup"]] = relationship("StudentGroup", back_populates="group")


class StudentGroup(Base):
    __tablename__ = "students_groups"
    __table_args__ = (UniqueConstraint("student_id", "group_id", name="uq_student_group"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False, index=True)

    student: Mapped["User"] = relationship(
        "User",
        back_populates="group_links",
        foreign_keys=[student_id],
    )
    group: Mapped["Group"] = relationship("Group", back_populates="students")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(50), nullable=False, default="multiple_choice")
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    topic: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    options: Mapped[list["Option"]] = relationship(
        "Option",
        back_populates="question",
        cascade="all, delete-orphan",
    )
    answers: Mapped[list["Answer"]] = relationship("Answer", back_populates="question")


class Option(Base):
    __tablename__ = "options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    question: Mapped["Question"] = relationship("Question", back_populates="options")


class Test(Base):
    __tablename__ = "tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[TestType] = mapped_column(
        Enum(TestType, name="test_type_enum", native_enum=False, validate_strings=True),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    attempts: Mapped[list["TestAttempt"]] = relationship("TestAttempt", back_populates="test")


class TestAttempt(Base):
    __tablename__ = "test_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    test_id: Mapped[int] = mapped_column(ForeignKey("tests.id"), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    score_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    level_result: Mapped[str | None] = mapped_column(String(100), nullable=True)
    theta_final: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="attempts")
    test: Mapped["Test"] = relationship("Test", back_populates="attempts")
    answers: Mapped[list["Answer"]] = relationship("Answer", back_populates="attempt")
    recommendations: Mapped[list["Recommendation"]] = relationship(
        "Recommendation",
        back_populates="attempt",
        cascade="all, delete-orphan",
    )
    error_profiles: Mapped[list["ErrorProfile"]] = relationship(
        "ErrorProfile",
        back_populates="attempt",
        cascade="all, delete-orphan",
    )


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("test_attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), nullable=False, index=True)
    selected_option_id: Mapped[int | None] = mapped_column(ForeignKey("options.id"), nullable=True)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    theta_before: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    theta_after: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)

    attempt: Mapped["TestAttempt"] = relationship("TestAttempt", back_populates="answers")
    question: Mapped["Question"] = relationship("Question", back_populates="answers")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("test_attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    attempt: Mapped["TestAttempt"] = relationship("TestAttempt", back_populates="recommendations")


class ErrorProfile(Base):
    __tablename__ = "error_profiles"
    __table_args__ = (UniqueConstraint("attempt_id", "topic", name="uq_attempt_topic"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("test_attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    topic: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wrong_answers: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    accuracy_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)

    attempt: Mapped["TestAttempt"] = relationship("TestAttempt", back_populates="error_profiles")
