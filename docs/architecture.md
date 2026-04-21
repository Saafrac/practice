# Stage 1-4 Architecture

## Overview

The project uses a simple client-server architecture:

- `mobile`: Expo app responsible for UI, navigation, and future API integration
- `backend`: FastAPI app responsible for authentication, testing logic, analytics, and database access
- `postgres`: relational database for users, tests, answers, and reports

## Initial technical decisions

- Mobile: Expo + React Native + TypeScript
- Navigation: React Navigation stack + tabs
- Backend: FastAPI + SQLAlchemy async engine
- Database: PostgreSQL
- Configuration: `.env` files per service

## Stage 1 deliverables

- Running mobile shell with splash/login/home placeholders
- Running FastAPI server with `/health`
- Database connectivity verification through backend health check
- Local infrastructure bootstrapped through Docker Compose

## Stage 2 deliverables

- SQLAlchemy model layer for core entities:
  - users, groups, students_groups
  - questions, options, tests
  - test_attempts, answers
  - recommendations, error_profiles
- Alembic migration `20260418_0001_create_core_schema.py`
- Idempotent seed script `app/db/seed.py`
- Demo data profile:
  - 5 users (admin/teacher/students)
  - 40 questions with 160 options
  - 3 tests and 1 demo student group

## Stage 3 deliverables

- Authentication API module:
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me`
- Security layer:
  - PBKDF2 password hashing
  - JWT signing and verification (HMAC SHA-256)
  - Bearer token dependency for protected routes
- Frontend auth integration:
  - Login and registration screens
  - Token persistence in secure device storage
  - Session restoration (autologin) on app boot
  - Role-based redirect to student/teacher/admin dashboard tabs

## Stage 4 deliverables

- Mobile UI framework for role screens:
  - Splash
  - Student Home
  - Teacher Dashboard
  - Admin Dashboard
  - Profile
- Reusable UI component set:
  - `PrimaryButton`
  - `AppCard`
  - `ProgressBar`
  - `StatBox`
  - `EmptyState`
  - `Loader`
- Unified dashboard layout style for demo readiness (cards, stats, progress, placeholders)
