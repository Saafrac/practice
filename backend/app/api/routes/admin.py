from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.orm import selectinload

from app.api.deps.auth import require_roles
from app.db.models import Option, Question, Test, User, UserRole
from app.db.session import get_db_session
from app.schemas.admin import (
    AdminQuestionItem,
    AdminQuestionOption,
    AdminQuestionsResponse,
    AdminQuestionUpsertRequest,
    AdminSystemStatusResponse,
    AdminUpdateUserRoleRequest,
    AdminUserItem,
    AdminUsersResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _question_to_schema(question: Question) -> AdminQuestionItem:
    return AdminQuestionItem(
        id=question.id,
        text=question.text,
        question_type=question.question_type,
        difficulty=question.difficulty,
        topic=question.topic,
        explanation=question.explanation,
        created_at=question.created_at,
        options=[
            AdminQuestionOption(
                id=option.id,
                text=option.text,
                is_correct=option.is_correct,
            )
            for option in question.options
        ],
    )


@router.get("/users", response_model=AdminUsersResponse)
async def users(current_user: User = Depends(require_roles(UserRole.ADMIN))) -> AdminUsersResponse:
    del current_user
    async with get_db_session() as session:
        rows = (await session.execute(select(User).order_by(User.created_at.desc()))).scalars().all()
    return AdminUsersResponse(users=[AdminUserItem.model_validate(row) for row in rows])


@router.get("/system-status", response_model=AdminSystemStatusResponse)
async def system_status(current_user: User = Depends(require_roles(UserRole.ADMIN))) -> AdminSystemStatusResponse:
    del current_user
    async with get_db_session() as session:
        await session.execute(text("SELECT 1"))
        users_count = await session.scalar(select(func.count(User.id)))
        questions_count = await session.scalar(select(func.count(Question.id)))
        active_tests_count = await session.scalar(select(func.count(Test.id)).where(Test.is_active.is_(True)))
        last_user_update = await session.scalar(select(func.max(User.created_at)))
        last_question_update = await session.scalar(select(func.max(Question.created_at)))

    last_updates = [value for value in (last_user_update, last_question_update) if value is not None]
    return AdminSystemStatusResponse(
        api_status="online",
        database_status="online",
        users_count=int(users_count or 0),
        questions_count=int(questions_count or 0),
        active_tests_count=int(active_tests_count or 0),
        last_seed_update=max(last_updates) if last_updates else None,
    )


@router.patch("/users/{user_id}/role", response_model=AdminUserItem)
async def update_user_role(
    user_id: int,
    payload: AdminUpdateUserRoleRequest,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminUserItem:
    async with get_db_session() as session:
        user = await session.scalar(select(User).where(User.id == user_id))
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        if user.id == current_user.id and payload.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin cannot remove own admin role.",
            )

        user.role = payload.role
        await session.commit()
        await session.refresh(user)
        return AdminUserItem.model_validate(user)


@router.get("/questions", response_model=AdminQuestionsResponse)
async def questions(
    difficulty: int | None = Query(default=None, ge=-2, le=2),
    topic: str | None = Query(default=None, min_length=1, max_length=100),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminQuestionsResponse:
    del current_user
    async with get_db_session() as session:
        query = select(Question).options(selectinload(Question.options)).order_by(Question.created_at.desc())
        if difficulty is not None:
            query = query.where(Question.difficulty == difficulty)
        if topic:
            query = query.where(Question.topic.ilike(f"%{topic.strip()}%"))
        rows = (await session.execute(query)).scalars().all()

    return AdminQuestionsResponse(questions=[_question_to_schema(row) for row in rows])


@router.post("/questions", response_model=AdminQuestionItem, status_code=status.HTTP_201_CREATED)
async def create_question(
    payload: AdminQuestionUpsertRequest,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminQuestionItem:
    del current_user
    if payload.correct_index >= len(payload.options):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="correct_index is out of range for options.",
        )

    async with get_db_session() as session:
        question = Question(
            text=payload.text.strip(),
            question_type="multiple_choice",
            difficulty=payload.difficulty,
            topic=payload.topic.strip().lower(),
            explanation=payload.explanation.strip() if payload.explanation else None,
        )
        session.add(question)
        await session.flush()

        for idx, option_text in enumerate(payload.options):
            session.add(
                Option(
                    question_id=question.id,
                    text=option_text.strip(),
                    is_correct=idx == payload.correct_index,
                )
            )

        await session.commit()
        question = await session.scalar(
            select(Question).where(Question.id == question.id).options(selectinload(Question.options))
        )
        return _question_to_schema(question)


@router.put("/questions/{question_id}", response_model=AdminQuestionItem)
async def update_question(
    question_id: int,
    payload: AdminQuestionUpsertRequest,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminQuestionItem:
    del current_user
    if payload.correct_index >= len(payload.options):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="correct_index is out of range for options.",
        )

    async with get_db_session() as session:
        question = await session.scalar(select(Question).where(Question.id == question_id))
        if question is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")

        question.text = payload.text.strip()
        question.difficulty = payload.difficulty
        question.topic = payload.topic.strip().lower()
        question.explanation = payload.explanation.strip() if payload.explanation else None

        existing_options = (
            await session.execute(select(Option).where(Option.question_id == question.id).order_by(Option.id.asc()))
        ).scalars().all()
        for option in existing_options:
            await session.delete(option)
        await session.flush()

        for idx, option_text in enumerate(payload.options):
            session.add(
                Option(
                    question_id=question.id,
                    text=option_text.strip(),
                    is_correct=idx == payload.correct_index,
                )
            )

        await session.commit()
        question = await session.scalar(
            select(Question).where(Question.id == question.id).options(selectinload(Question.options))
        )
        return _question_to_schema(question)


@router.delete("/questions/{question_id}", status_code=status.HTTP_200_OK)
async def delete_question(
    question_id: int,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> dict[str, str]:
    del current_user
    async with get_db_session() as session:
        question = await session.scalar(select(Question).where(Question.id == question_id))
        if question is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")
        await session.delete(question)
        await session.commit()
    return {"status": "deleted"}
