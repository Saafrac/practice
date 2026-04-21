from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps.auth import get_current_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.models import User
from app.db.session import get_db_session
from app.schemas.auth import AuthLoginRequest, AuthRegisterRequest, AuthTokenResponse, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: AuthRegisterRequest) -> AuthTokenResponse:
    normalized_email = payload.email.strip().lower()
    async with get_db_session() as session:
        existing_user = await session.scalar(select(User).where(User.email == normalized_email))
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists.",
            )

        user = User(
            full_name=payload.full_name.strip(),
            email=normalized_email,
            password_hash=get_password_hash(payload.password),
            role=payload.role,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return AuthTokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.post("/login", response_model=AuthTokenResponse, status_code=status.HTTP_200_OK)
async def login(payload: AuthLoginRequest) -> AuthTokenResponse:
    normalized_email = payload.email.strip().lower()
    async with get_db_session() as session:
        user = await session.scalar(select(User).where(User.email == normalized_email))

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return AuthTokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic, status_code=status.HTTP_200_OK)
async def me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)
