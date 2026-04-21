from fastapi import APIRouter, status
from sqlalchemy import text

from app.db.session import get_db_session

router = APIRouter(tags=["health"])


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check() -> dict[str, str]:
    async with get_db_session() as session:
        await session.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "service": "backend",
        "database": "connected",
    }
