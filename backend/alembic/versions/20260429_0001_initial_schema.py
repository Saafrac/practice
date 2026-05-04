"""initial schema

Revision ID: 20260429_0001
Revises:
Create Date: 2026-04-29
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260429_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "STUDENT",
                "TEACHER",
                "ADMIN",
                name="user_role_enum",
                native_enum=False,
                validate_strings=True,
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "questions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("question_type", sa.String(length=50), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column("topic", sa.String(length=100), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_questions_difficulty"), "questions", ["difficulty"], unique=False)
    op.create_index(op.f("ix_questions_id"), "questions", ["id"], unique=False)
    op.create_index(op.f("ix_questions_topic"), "questions", ["topic"], unique=False)

    op.create_table(
        "tests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "DIAGNOSTIC",
                "ADAPTIVE",
                "FINAL",
                name="test_type_enum",
                native_enum=False,
                validate_strings=True,
            ),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tests_id"), "tests", ["id"], unique=False)

    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_groups_id"), "groups", ["id"], unique=False)
    op.create_index(op.f("ix_groups_teacher_id"), "groups", ["teacher_id"], unique=False)

    op.create_table(
        "options",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_options_id"), "options", ["id"], unique=False)
    op.create_index(op.f("ix_options_question_id"), "options", ["question_id"], unique=False)

    op.create_table(
        "students_groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "group_id", name="uq_student_group"),
    )
    op.create_index(op.f("ix_students_groups_group_id"), "students_groups", ["group_id"], unique=False)
    op.create_index(op.f("ix_students_groups_id"), "students_groups", ["id"], unique=False)
    op.create_index(op.f("ix_students_groups_student_id"), "students_groups", ["student_id"], unique=False)

    op.create_table(
        "test_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("test_id", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("score_percent", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("level_result", sa.String(length=100), nullable=True),
        sa.Column("theta_final", sa.Numeric(precision=4, scale=2), nullable=True),
        sa.ForeignKeyConstraint(["test_id"], ["tests.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_test_attempts_id"), "test_attempts", ["id"], unique=False)
    op.create_index(op.f("ix_test_attempts_test_id"), "test_attempts", ["test_id"], unique=False)
    op.create_index(op.f("ix_test_attempts_user_id"), "test_attempts", ["user_id"], unique=False)

    op.create_table(
        "answers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("attempt_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("selected_option_id", sa.Integer(), nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("theta_before", sa.Numeric(precision=4, scale=2), nullable=True),
        sa.Column("theta_after", sa.Numeric(precision=4, scale=2), nullable=True),
        sa.ForeignKeyConstraint(["attempt_id"], ["test_attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"]),
        sa.ForeignKeyConstraint(["selected_option_id"], ["options.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_answers_attempt_id"), "answers", ["attempt_id"], unique=False)
    op.create_index(op.f("ix_answers_id"), "answers", ["id"], unique=False)
    op.create_index(op.f("ix_answers_question_id"), "answers", ["question_id"], unique=False)

    op.create_table(
        "recommendations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("attempt_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["test_attempts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_recommendations_attempt_id"), "recommendations", ["attempt_id"], unique=False)
    op.create_index(op.f("ix_recommendations_category"), "recommendations", ["category"], unique=False)
    op.create_index(op.f("ix_recommendations_id"), "recommendations", ["id"], unique=False)

    op.create_table(
        "error_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("attempt_id", sa.Integer(), nullable=False),
        sa.Column("topic", sa.String(length=100), nullable=False),
        sa.Column("total_questions", sa.Integer(), nullable=False),
        sa.Column("wrong_answers", sa.Integer(), nullable=False),
        sa.Column("accuracy_percent", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["attempt_id"], ["test_attempts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("attempt_id", "topic", name="uq_attempt_topic"),
    )
    op.create_index(op.f("ix_error_profiles_attempt_id"), "error_profiles", ["attempt_id"], unique=False)
    op.create_index(op.f("ix_error_profiles_id"), "error_profiles", ["id"], unique=False)
    op.create_index(op.f("ix_error_profiles_topic"), "error_profiles", ["topic"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_error_profiles_topic"), table_name="error_profiles")
    op.drop_index(op.f("ix_error_profiles_id"), table_name="error_profiles")
    op.drop_index(op.f("ix_error_profiles_attempt_id"), table_name="error_profiles")
    op.drop_table("error_profiles")

    op.drop_index(op.f("ix_recommendations_id"), table_name="recommendations")
    op.drop_index(op.f("ix_recommendations_category"), table_name="recommendations")
    op.drop_index(op.f("ix_recommendations_attempt_id"), table_name="recommendations")
    op.drop_table("recommendations")

    op.drop_index(op.f("ix_answers_question_id"), table_name="answers")
    op.drop_index(op.f("ix_answers_id"), table_name="answers")
    op.drop_index(op.f("ix_answers_attempt_id"), table_name="answers")
    op.drop_table("answers")

    op.drop_index(op.f("ix_test_attempts_user_id"), table_name="test_attempts")
    op.drop_index(op.f("ix_test_attempts_test_id"), table_name="test_attempts")
    op.drop_index(op.f("ix_test_attempts_id"), table_name="test_attempts")
    op.drop_table("test_attempts")

    op.drop_index(op.f("ix_students_groups_student_id"), table_name="students_groups")
    op.drop_index(op.f("ix_students_groups_id"), table_name="students_groups")
    op.drop_index(op.f("ix_students_groups_group_id"), table_name="students_groups")
    op.drop_table("students_groups")

    op.drop_index(op.f("ix_options_question_id"), table_name="options")
    op.drop_index(op.f("ix_options_id"), table_name="options")
    op.drop_table("options")

    op.drop_index(op.f("ix_groups_teacher_id"), table_name="groups")
    op.drop_index(op.f("ix_groups_id"), table_name="groups")
    op.drop_table("groups")

    op.drop_index(op.f("ix_tests_id"), table_name="tests")
    op.drop_table("tests")

    op.drop_index(op.f("ix_questions_topic"), table_name="questions")
    op.drop_index(op.f("ix_questions_id"), table_name="questions")
    op.drop_index(op.f("ix_questions_difficulty"), table_name="questions")
    op.drop_table("questions")

    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
