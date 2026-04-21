#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
python - <<'PY'
import asyncio
import os
import time

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

database_url = os.environ["DATABASE_URL"]

async def wait_for_db() -> None:
    for _ in range(60):
        engine = create_async_engine(database_url)
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            await engine.dispose()
            print("PostgreSQL is ready.")
            return
        except Exception:
            await engine.dispose()
            time.sleep(1)
    raise SystemExit("Database connection timeout.")

asyncio.run(wait_for_db())
PY

echo "Running migrations..."
alembic upgrade head

echo "Seeding demo data..."
python -m app.db.seed

echo "Starting API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
