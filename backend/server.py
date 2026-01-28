from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from openai import AsyncOpenAI
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, delete, func, select, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from starlette.middleware.cors import CORSMiddleware


# ------------------------------------------------------------------------------
# Env / Config
# ------------------------------------------------------------------------------

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("make_it_happen")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


raw_db_url = require_env("DATABASE_URL")
# Render sometimes provides postgres://
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif raw_db_url.startswith("postgresql://"):
    raw_db_url = raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

DATABASE_URL = raw_db_url

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = int(os.getenv("JWT_EXPIRATION_DAYS", "30"))

# Daily rollover config (local “day” flips at 5am by default)
LOCAL_TZ = ZoneInfo(os.getenv("LOCAL_TIMEZONE", "America/Chicago"))
DAY_ROLLOVER_HOUR = int(os.getenv("DAY_ROLLOVER_HOUR", "5"))  # 5am local

# AI generation concurrency (prevents N focus areas = N simultaneous calls)
AI_MAX_CONCURRENCY = int(os.getenv("AI_MAX_CONCURRENCY", "4"))


def effective_day(now_utc: datetime | None = None) -> date:
    """
    The user's 'today' rolls over at DAY_ROLLOVER_HOUR in LOCAL_TZ.
    Before that hour, we treat it as the previous day.
    """
    now_utc = now_utc or datetime.now(timezone.utc)
    local = now_utc.astimezone(LOCAL_TZ)
    d = local.date()
    if local.hour < DAY_ROLLOVER_HOUR:
        d = d - timedelta(days=1)
    return d


# ------------------------------------------------------------------------------
# AI config: Together (OpenAI-compatible) OR OpenAI
# ------------------------------------------------------------------------------

AI_API_KEY = os.getenv("TOGETHER_API_KEY") or os.getenv("OPENAI_API_KEY")
AI_BASE_URL = os.getenv("AI_BASE_URL") or ("https://api.together.xyz/v1" if os.getenv("TOGETHER_API_KEY") else None)
AI_MODEL = os.getenv("AI_MODEL") or os.getenv("OPENAI_MODEL") or "gpt-4o-mini"

openai_client = AsyncOpenAI(api_key=AI_API_KEY, base_url=AI_BASE_URL) if AI_API_KEY else None

AUTO_CREATE_TABLES = os.getenv("AUTO_CREATE_TABLES", "false").lower() == "true"


# ------------------------------------------------------------------------------
# DB setup (Async SQLAlchemy)
# ------------------------------------------------------------------------------

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


# ------------------------------------------------------------------------------
# Tables
# ------------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)

    raw_input: Mapped[str] = mapped_column(Text, nullable=False)
    images: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    timeline: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    goal_id: Mapped[str] = mapped_column(String(36), ForeignKey("goals.id"), index=True, nullable=False)

    focus_areas: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    timeline: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DailyAction(Base):
    __tablename__ = "daily_actions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    plan_id: Mapped[str] = mapped_column(String(36), ForeignKey("plans.id"), index=True, nullable=False)

    focus_area: Mapped[str] = mapped_column(String(128), nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)

    day: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rescheduled_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)


# ------------------------------------------------------------------------------
# FastAPI app / router
# ------------------------------------------------------------------------------

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()


# ------------------------------------------------------------------------------
# Pydantic Models
# ------------------------------------------------------------------------------


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class GoalDumpRequest(BaseModel):
    text: str
    images: Optional[List[str]] = []
    timeline: str


class PlanResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    goal_id: str
    focus_areas: List[Dict[str, Any]]
    timeline: str
    created_at: str
    status: str


class CheckInRequest(BaseModel):
    action_id: str
    completed: bool


class StreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    total_completed: int
    message: str


class WeeklySummary(BaseModel):
    week_start: str
    week_end: str
    total_actions: int
    completed_actions: int
    completion_rate: float
    focus_areas_progress: List[Dict[str, Any]]
    wins: List[str]
    momentum_message: str


# ------------------------------------------------------------------------------
# DB dependency
# ------------------------------------------------------------------------------


async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session


# ------------------------------------------------------------------------------
# Auth helpers
# ------------------------------------------------------------------------------


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    return jwt.encode({"user_id": user_id, "exp": expiration}, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ------------------------------------------------------------------------------
# AI helpers
# ------------------------------------------------------------------------------


def get_timeline_context(timeline: str) -> str:
    return {
        "1_month": "They want to achieve this in 1 month. Break it into weekly milestones.",
        "3_months": "They have 3 months. Create sustainable monthly phases.",
        "6_months": "They have 6 months. Build gradually with clear monthly themes.",
        "1_year": "They have a year. Create quarterly milestones with monthly focuses.",
        "new_year": "New Year's resolution. Start in January with quarterly check-ins.",
    }.get(timeline, "Create a balanced plan based on goal complexity.")


def extract_json_object(text: str) -> Dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end <= start:
        return {"focus_areas": []}
    try:
        return json.loads(text[start:end])
    except Exception:
        return {"focus_areas": []}


def fallback_focus_areas(text: str, timeline: str) -> Dict[str, Any]:
    _ = (text or "").strip()
    return {
        "focus_areas": [
            {
                "name": "Clarity",
                "description": "Turn your dump into a few clear priorities you can actually act on.",
                "success_looks_like": "You can explain your top 3 goals and your next step for each.",
                "outcomes": ["Pick your top 3 priorities", "Define a next step for each"],
                "monthly_direction": "Clarify what matters most and remove distractions.",
                "weekly_focus": "Choose one priority to focus on this week.",
                "daily_action": "Write your top 3 goals as bullets and circle the #1 (5–10 min).",
            },
            {
                "name": "Momentum",
                "description": "Build consistency with tiny daily actions (no guilt, just progress).",
                "success_looks_like": "You complete at least 1 small action per day most days.",
                "outcomes": ["Set a 15-minute daily habit", "Track daily check-ins"],
                "monthly_direction": "Make progress feel easy and repeatable.",
                "weekly_focus": "Do the smallest version of the work daily.",
                "daily_action": "Set a 15-minute timer and do the smallest next step for your #1 goal.",
            },
        ]
    }


async def analyze_goal_with_ai(text: str, images: List[str], timeline: str) -> Dict[str, Any]:
    timeline_context = get_timeline_context(timeline)

    system = (
        "You are a thoughtful life coach who helps people translate dreams into actionable plans. "
        "Be warm, encouraging, and practical. Always provide concrete, specific actions."
    )

    prompt = f"""
Analyze this person's goals and aspirations:

{text}

Timeline: {timeline_context}

Extract 2-4 main focus areas.

For each focus area, provide:
name, description, success_looks_like, outcomes (2-3),
monthly_direction, weekly_focus, daily_action (ONE concrete action for today, 15–30 min)

Respond ONLY in JSON:
{{
 "focus_areas": [
   {{
     "name": "...",
     "description": "...",
     "success_looks_like": "...",
     "outcomes": ["...", "..."],
     "monthly_direction": "...",
     "weekly_focus": "...",
     "daily_action": "..."
   }}
 ]
}}
""".strip()

    if not openai_client:
        logger.warning("AI key not set. Using fallback plan.")
        return fallback_focus_areas(text, timeline)

    try:
        resp = await openai_client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
        )
        content = resp.choices[0].message.content or ""
        parsed = extract_json_object(content)

        if not parsed.get("focus_areas"):
            logger.warning("AI returned empty focus_areas. Using fallback plan.")
            return fallback_focus_areas(text, timeline)

        return parsed
    except Exception:
        logger.exception("AI analysis failed. Using fallback plan.")
        return fallback_focus_areas(text, timeline)


# ------------------------------------------------------------------------------
# Daily generation helpers
# ------------------------------------------------------------------------------


def fallback_next_action(focus_area: Dict[str, Any], day_index: int) -> str:
    """
    Better non-AI fallback: varies by focus_area content, not the same sentence for all.
    """
    name = (focus_area.get("name") or "Focus").strip()
    weekly = (focus_area.get("weekly_focus") or "").strip()
    monthly = (focus_area.get("monthly_direction") or "").strip()
    base = weekly or monthly or "Move this forward with a small concrete step."

    variants = [
        f"Do a 15–30 min micro-step toward: {base}",
        f"Make it real: produce a tiny deliverable toward: {base}",
        f"Remove one blocker for: {base} (list 3 sub-steps, then do the first)",
        f"Ship something small today for: {base}",
        f"Review + adjust: what did you learn about {name}? Then choose the next tiny step.",
    ]
    return variants[day_index % len(variants)]


async def generate_next_action_with_ai(
    plan: Plan,
    focus_area: Dict[str, Any],
    yesterday_actions: List[DailyAction],
    day_index: int,
) -> str:
    """
    Create ONE concrete action for today that builds on yesterday.
    Falls back to a better heuristic if AI isn't available.
    """
    if not openai_client:
        return fallback_next_action(focus_area, day_index)

    name = focus_area.get("name", "Focus")
    monthly = focus_area.get("monthly_direction", "")
    weekly = focus_area.get("weekly_focus", "")
    success = focus_area.get("success_looks_like", "")
    outcomes = focus_area.get("outcomes", [])

    # Pull yesterday's items for this focus area (completed + incomplete)
    y_items = [{"action": a.action, "completed": bool(a.completed)} for a in yesterday_actions if a.focus_area == name]

    system = (
        "You are a practical, encouraging coach. "
        "Generate a single concrete, specific action for TODAY that takes 15–30 minutes. "
        "It must build on yesterday's work and aim toward the user's timeline goal. "
        "No generic advice. No multi-step lists. Output ONLY the action sentence."
    )

    timeline_context = get_timeline_context(plan.timeline)

    prompt = f"""
Timeline: {timeline_context}

Focus area:
- name: {name}
- monthly_direction: {monthly}
- weekly_focus: {weekly}
- success_looks_like: {success}
- outcomes: {outcomes}

Yesterday actions for this focus area (completed/incomplete):
{json.dumps(y_items, ensure_ascii=False)}

Day index since plan started: {day_index}

Write ONE action for today (15–30 min) that:
- continues unfinished work if any unfinished exists
- otherwise progresses logically from completed work
- is concrete (send X message, draft Y, practice Z minutes, etc.)

Return ONLY the action sentence.
""".strip()

    try:
        resp = await openai_client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            temperature=0.6,
        )
        out = (resp.choices[0].message.content or "").strip()
        if not out:
            return fallback_next_action(focus_area, day_index)
        return out.splitlines()[0].strip()
    except Exception:
        logger.exception("AI next-action generation failed; using fallback.")
        return fallback_next_action(focus_area, day_index)


async def ensure_fresh_actions_for_today(db: AsyncSession, user_id: str) -> None:
    """
    More efficient version:
    - minimizes round-trips (batch queries)
    - single commit
    - optional bounded concurrency for AI calls
    """
    today = effective_day()
    yesterday = today - timedelta(days=1)

    # 1) fetch all active plans (single query)
    plans_q = await db.execute(select(Plan).where(Plan.user_id == user_id, Plan.status == "active"))
    plans = plans_q.scalars().all()
    if not plans:
        return

    plan_ids = [p.id for p in plans]

    # 2) which plans already have a fresh (non-rescheduled) action for today?
    existing_q = await db.execute(
        select(DailyAction.plan_id)
        .where(
            DailyAction.user_id == user_id,
            DailyAction.day == today,
            DailyAction.rescheduled_from == None,  # noqa: E711
            DailyAction.plan_id.in_(plan_ids),
        )
        .distinct()
    )
    existing_fresh_plan_ids = {pid for (pid,) in existing_q.all()}

    plans_to_generate = [p for p in plans if p.id not in existing_fresh_plan_ids]
    if not plans_to_generate:
        return

    plans_to_generate_ids = [p.id for p in plans_to_generate]

    # 3) fetch yesterday actions for all these plans (single query)
    yq = await db.execute(
        select(DailyAction).where(
            DailyAction.user_id == user_id,
            DailyAction.plan_id.in_(plans_to_generate_ids),
            DailyAction.day == yesterday,
        )
    )
    y_actions = yq.scalars().all()
    y_by_plan: Dict[str, List[DailyAction]] = {}
    for a in y_actions:
        y_by_plan.setdefault(a.plan_id, []).append(a)

    # 4) fetch first day per plan (single grouped query)
    first_q = await db.execute(
        select(DailyAction.plan_id, func.min(DailyAction.day))
        .where(DailyAction.user_id == user_id, DailyAction.plan_id.in_(plans_to_generate_ids))
        .group_by(DailyAction.plan_id)
    )
    first_day_by_plan: Dict[str, date] = {pid: d for (pid, d) in first_q.all() if d is not None}

    # 5) generate actions (bounded AI concurrency if enabled)
    semaphore = asyncio.Semaphore(AI_MAX_CONCURRENCY)
    new_rows: List[DailyAction] = []

    async def gen_one(plan: Plan, area: Dict[str, Any], day_index: int, y_list: List[DailyAction]) -> str:
        if not openai_client:
            return fallback_next_action(area, day_index)

        async with semaphore:
            return await generate_next_action_with_ai(plan, area, y_list, day_index)

    tasks: List[asyncio.Task] = []
    task_meta: List[tuple[str, str, str]] = []  # (plan_id, focus_name, action_id)

    for plan in plans_to_generate:
        first_day = first_day_by_plan.get(plan.id)
        day_index = (today - first_day).days if first_day else 0
        y_list = y_by_plan.get(plan.id, [])

        for area in (plan.focus_areas or []):
            focus_name = area.get("name", "Focus")
            action_id = str(uuid.uuid4())
            task_meta.append((plan.id, focus_name, action_id))

            if openai_client:
                tasks.append(asyncio.create_task(gen_one(plan, area, day_index, y_list)))
            else:
                # no AI: sync fallback (avoid creating tasks)
                tasks.append(asyncio.create_task(asyncio.sleep(0, result=fallback_next_action(area, day_index))))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    for (plan_id, focus_name, action_id), result in zip(task_meta, results):
        if isinstance(result, Exception):
            logger.exception("Action generation failed; using fallback.", exc_info=result)
            action_text = "Take one small step today."
        else:
            action_text = (result or "Take one small step today.").strip()

        new_rows.append(
            DailyAction(
                id=action_id,
                user_id=user_id,
                plan_id=plan_id,
                focus_area=focus_name,
                action=action_text,
                day=today,
                completed=False,
                completed_at=None,
                rescheduled_from=None,
            )
        )

    db.add_all(new_rows)
    await db.commit()


# ------------------------------------------------------------------------------
# Progress helpers (Postgres)
# ------------------------------------------------------------------------------


async def reschedule_incomplete_actions(db: AsyncSession, user_id: str) -> None:
    """
    More efficient version:
    - avoids per-row duplicate queries
    - batches reads, then inserts only missing
    """
    today = effective_day()
    yesterday = today - timedelta(days=1)

    # If we already carried over from yesterday -> today, don't do it again
    already_carried_q = await db.execute(
        select(DailyAction.id).where(
            DailyAction.user_id == user_id,
            DailyAction.day == today,
            DailyAction.rescheduled_from == yesterday,
        ).limit(1)
    )
    if already_carried_q.scalar_one_or_none():
        return

    # Fetch yesterday incompletes (single query)
    yq = await db.execute(
        select(DailyAction).where(
            DailyAction.user_id == user_id,
            DailyAction.day == yesterday,
            DailyAction.completed == False,  # noqa: E712
        )
    )
    rows = yq.scalars().all()
    if not rows:
        return

    # Fetch today's carried actions keys (single query)
    tq = await db.execute(
        select(DailyAction.plan_id, DailyAction.focus_area, DailyAction.action).where(
            DailyAction.user_id == user_id,
            DailyAction.day == today,
            DailyAction.rescheduled_from == yesterday,
        )
    )
    existing_keys = {(pid, fa, act) for (pid, fa, act) in tq.all()}

    to_add: List[DailyAction] = []
    for a in rows:
        key = (a.plan_id, a.focus_area, a.action)
        if key in existing_keys:
            continue
        to_add.append(
            DailyAction(
                id=str(uuid.uuid4()),
                user_id=a.user_id,
                plan_id=a.plan_id,
                focus_area=a.focus_area,
                action=a.action,
                day=today,
                completed=False,
                completed_at=None,
                rescheduled_from=yesterday,
            )
        )

    if not to_add:
        return

    db.add_all(to_add)
    await db.commit()


async def calculate_streak(db: AsyncSession, user_id: str) -> Dict[str, Any]:
    q = await db.execute(
        select(DailyAction.day)
        .where(DailyAction.user_id == user_id, DailyAction.completed == True)  # noqa: E712
        .order_by(DailyAction.day.desc())
        .limit(2000)
    )
    days = [d for (d,) in q.all()]
    if not days:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "total_completed": 0,
            "message": "Start your first action to begin your journey!",
        }

    unique_days = sorted(set(days), reverse=True)
    total_completed = len(days)

    today = effective_day()

    current_streak = 0
    for i, d in enumerate(unique_days):
        if d == (today - timedelta(days=i)):
            current_streak += 1
        else:
            break

    longest = 1
    run = 1
    for i in range(len(unique_days) - 1):
        if (unique_days[i] - unique_days[i + 1]).days == 1:
            run += 1
            longest = max(longest, run)
        else:
            run = 1
    longest = max(longest, current_streak)

    if current_streak == 0:
        message = "Tomorrow is a fresh start! 🌱"
    elif current_streak == 1:
        message = "One day at a time! Keep going 🌟"
    elif current_streak < 7:
        message = f"{current_streak} days of small steps! You're building something beautiful 🌸"
    elif current_streak < 30:
        message = f"{current_streak} days of showing up! This is becoming who you are 💫"
    else:
        message = f"{current_streak} days of gentle progress! You're amazing 🌈"

    return {
        "current_streak": current_streak,
        "longest_streak": longest,
        "total_completed": total_completed,
        "message": message,
    }


async def generate_weekly_summary(db: AsyncSession, user_id: str) -> Dict[str, Any]:
    today = effective_day()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    q = await db.execute(
        select(DailyAction).where(
            DailyAction.user_id == user_id,
            DailyAction.day >= week_start,
            DailyAction.day <= week_end,
        )
    )
    actions = q.scalars().all()

    total = len(actions)
    completed = sum(1 for a in actions if a.completed)
    completion_rate = (completed / total * 100) if total else 0.0

    progress: Dict[str, Dict[str, int]] = {}
    for a in actions:
        progress.setdefault(a.focus_area, {"total": 0, "completed": 0})
        progress[a.focus_area]["total"] += 1
        if a.completed:
            progress[a.focus_area]["completed"] += 1

    focus_areas_progress = [
        {
            "name": name,
            "completed": data["completed"],
            "total": data["total"],
            "rate": round((data["completed"] / data["total"] * 100) if data["total"] else 0, 1),
        }
        for name, data in progress.items()
    ]

    wins = [f"{a.focus_area}: {a.action}" for a in actions if a.completed][:5]

    if completion_rate >= 80:
        momentum_message = f"Incredible momentum this week! {completed} actions completed — you're moving 🚀"
    elif completion_rate >= 60:
        momentum_message = f"Solid week! {completed} actions done. Keep stacking wins 🌟"
    elif completion_rate >= 40:
        momentum_message = f"You showed up {completed} times this week. That counts 🌱"
    elif completion_rate > 0:
        momentum_message = f"{completed} small steps this week. Progress > perfection 💚"
    else:
        momentum_message = "New week, fresh start! Your goals are waiting 🌅"

    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "total_actions": total,
        "completed_actions": completed,
        "completion_rate": round(completion_rate, 1),
        "focus_areas_progress": focus_areas_progress,
        "wins": wins,
        "momentum_message": momentum_message,
    }


# ------------------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------------------


@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(user: UserCreate, db: AsyncSession = Depends(get_db)):
    q = await db.execute(select(User).where(User.email == user.email))
    if q.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        id=str(uuid.uuid4()),
        email=user.email,
        password_hash=hash_password(user.password),
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    token = create_token(new_user.id)
    return AuthResponse(
        token=token,
        user=UserResponse(id=new_user.id, email=new_user.email, created_at=new_user.created_at.isoformat()),
    )


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    q = await db.execute(select(User).where(User.email == credentials.email))
    user = q.scalar_one_or_none()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user.id)
    return AuthResponse(
        token=token,
        user=UserResponse(id=user.id, email=user.email, created_at=user.created_at.isoformat()),
    )


@api_router.get("/auth/me", response_model=UserResponse)
async def me(user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    q = await db.execute(select(User).where(User.id == user_id))
    user = q.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(id=user.id, email=user.email, created_at=user.created_at.isoformat())


@api_router.post("/goals/dump")
async def dump_goal(request: GoalDumpRequest, user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    goal = Goal(
        id=str(uuid.uuid4()),
        user_id=user_id,
        raw_input=request.text,
        images=request.images or [],
        timeline=request.timeline,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)

    analysis = await analyze_goal_with_ai(request.text, request.images or [], request.timeline)
    focus_areas = analysis.get("focus_areas") or []

    if not focus_areas:
        focus_areas = fallback_focus_areas(request.text, request.timeline)["focus_areas"]

    plan = Plan(
        id=str(uuid.uuid4()),
        user_id=user_id,
        goal_id=goal.id,
        focus_areas=focus_areas,
        timeline=request.timeline,
        status="active",
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)

    today = effective_day()

    for area in focus_areas:
        db.add(
            DailyAction(
                id=str(uuid.uuid4()),
                user_id=user_id,
                plan_id=plan.id,
                focus_area=area.get("name", "Focus"),
                action=area.get("daily_action", "Take one small step today."),
                day=today,
                completed=False,
            )
        )
    await db.commit()

    return {"goal_id": goal.id, "plan_id": plan.id, "focus_areas": focus_areas}


@api_router.get("/plans/current", response_model=Optional[PlanResponse])
async def get_current_plan(user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    q = await db.execute(
        select(Plan)
        .where(Plan.user_id == user_id, Plan.status == "active")
        .order_by(Plan.created_at.desc())
        .limit(1)
    )
    plan = q.scalar_one_or_none()
    if not plan:
        return None

    return PlanResponse(
        id=plan.id,
        user_id=plan.user_id,
        goal_id=plan.goal_id,
        focus_areas=plan.focus_areas,
        timeline=plan.timeline,
        created_at=plan.created_at.isoformat(),
        status=plan.status,
    )


@api_router.get("/plans", response_model=List[PlanResponse])
async def list_plans(user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    q = await db.execute(
        select(Plan)
        .where(Plan.user_id == user_id)
        .order_by(Plan.created_at.desc())
        .limit(100)
    )
    plans = q.scalars().all()

    return [
        PlanResponse(
            id=p.id,
            user_id=p.user_id,
            goal_id=p.goal_id,
            focus_areas=p.focus_areas,
            timeline=p.timeline,
            created_at=p.created_at.isoformat(),
            status=p.status,
        )
        for p in plans
    ]


@api_router.get("/daily/today")
async def today_actions(user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    today = effective_day()

    await reschedule_incomplete_actions(db, user_id)
    await ensure_fresh_actions_for_today(db, user_id)

    q = await db.execute(select(DailyAction).where(DailyAction.user_id == user_id, DailyAction.day == today))
    actions = q.scalars().all()

    return [
        {
            "id": a.id,
            "user_id": a.user_id,
            "plan_id": a.plan_id,
            "focus_area": a.focus_area,
            "action": a.action,
            "date": a.day.isoformat(),
            "completed": a.completed,
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
            "rescheduled_from": a.rescheduled_from.isoformat() if a.rescheduled_from else None,
        }
        for a in actions
    ]


@api_router.post("/daily/check-in")
async def check_in(request: CheckInRequest, user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    stmt = (
        update(DailyAction)
        .where(DailyAction.id == request.action_id, DailyAction.user_id == user_id)
        .values(completed=request.completed, completed_at=(now if request.completed else None))
    )
    res = await db.execute(stmt)
    await db.commit()

    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Action not found")

    return {"success": True}


@api_router.get("/streak", response_model=StreakResponse)
async def streak(user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    return await calculate_streak(db, user_id)


@api_router.get("/weekly-summary", response_model=WeeklySummary)
async def weekly(user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    return await generate_weekly_summary(db, user_id)


@api_router.get("/progress")
async def progress(user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    cutoff = effective_day() - timedelta(days=30)
    q = await db.execute(
        select(DailyAction)
        .where(DailyAction.user_id == user_id, DailyAction.day >= cutoff)
        .order_by(DailyAction.day.asc())
    )
    actions = q.scalars().all()

    total = len(actions)
    completed = sum(1 for a in actions if a.completed)
    completion_rate = (completed / total * 100) if total else 0.0

    return {
        "total_actions": total,
        "completed_actions": completed,
        "completion_rate": round(completion_rate, 1),
        "actions": [
            {
                "id": a.id,
                "plan_id": a.plan_id,
                "focus_area": a.focus_area,
                "action": a.action,
                "date": a.day.isoformat(),
                "completed": a.completed,
                "completed_at": a.completed_at.isoformat() if a.completed_at else None,
            }
            for a in actions
        ],
    }


@api_router.post("/plans/start-fresh")
async def start_fresh(user_id: str = Depends(get_user_id), db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(Plan)
        .where(Plan.user_id == user_id, Plan.status != "archived")
        .values(status="archived")
    )

    await db.execute(delete(DailyAction).where(DailyAction.user_id == user_id))

    await db.commit()
    return {"success": True}


# ------------------------------------------------------------------------------
# Middleware / Startup
# ------------------------------------------------------------------------------


def parse_cors_origins(value: str | None) -> List[str]:
    if not value:
        return ["*"]
    value = value.strip()
    if value == "*":
        return ["*"]
    return [v.strip() for v in value.split(",") if v.strip()]


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=parse_cors_origins(os.getenv("CORS_ORIGINS")),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    if AUTO_CREATE_TABLES:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)


@app.on_event("shutdown")
async def shutdown():
    await engine.dispose()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
