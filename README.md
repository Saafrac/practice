# Adaptive English Test AI

Stage 1-4 scaffold for a mobile adaptive English testing app.

## Project structure

- `mobile` - Expo + React Native + TypeScript client
- `backend` - FastAPI + PostgreSQL API
- `docs` - project documentation

## Requirements

- Node.js 20+
- Python 3.13+
- Docker Desktop with Docker Compose

## Quick start

### One-command Docker run (recommended for web testing)

```bash
docker compose up --build
```

After startup:

- Web app: `http://localhost:8080`
- Backend API: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`

To stop:

```bash
docker compose down
```

### 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 2. Start backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Alternative runner:

```bash
cd backend
python run_uvicorn.py
```

Health endpoint:

```bash
http://127.0.0.1:8000/health
```

### 2.1 Run database migrations (Stage 2)

Use Alembic command through Python API:

```bash
cd backend
python -c "from alembic.config import CommandLine; CommandLine().main(argv=['-c','alembic.ini','upgrade','head'])"
```

### 2.2 Seed demo data (Stage 2)

```bash
cd backend
python -m app.db.seed
```

Seed data includes:

- 5 demo users (`admin`, `teacher`, `3 students`)
- 1 demo group and student links
- 3 tests (`diagnostic`, `adaptive`, `final`)
- 40 multiple-choice questions with options and topics

Demo credentials:

- `admin@adaptive.test` / `Admin123!`
- `teacher@adaptive.test` / `Teacher123!`
- `alex@adaptive.test` / `Student123!`
- `bella@adaptive.test` / `Student123!`
- `chris@adaptive.test` / `Student123!`

### 3. Start mobile app

```bash
cd mobile
copy .env.example .env
npm install
npm run start
```

Open the Expo QR in Expo Go on Android or launch an emulator.

## Environment files

- `backend/.env.example`
- `mobile/.env.example`

## Local ports

- Backend API: `8000`
- PostgreSQL container: `5433` on the host mapped to container `5432`

## Current stage status

Stage 1 includes:

- Expo client scaffold with role-based navigation shell
- FastAPI backend with environment-based config
- PostgreSQL connection check on `/health`
- Docker Compose for local PostgreSQL
- Basic docs and setup instructions

Stage 2 includes:

- Full SQLAlchemy data model for users, tests, questions, answers, attempts, recommendations, and analytics
- Initial Alembic migration for schema creation
- Idempotent seed script with demo accounts and question bank

Stage 3 includes:

- JWT-based auth flow: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- Password hashing (PBKDF2) and Bearer token validation
- Role-aware mobile authentication flow (login/register)
- Persistent token storage and autologin on app launch
- Role-based dashboard routing after successful sign-in

Stage 4 includes:

- UI shell for all roles: splash, student home, teacher dashboard, admin dashboard, profile
- Reusable UI components:
  - `PrimaryButton`
  - `AppCard`
  - `ProgressBar`
  - `StatBox`
  - `EmptyState`
  - `Loader`
- Unified visual style across role dashboards with responsive scroll layouts
