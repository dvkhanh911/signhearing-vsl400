from datetime import UTC, date, datetime, timedelta
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from app.services import legacy
from app.services import supabase as sb

router = APIRouter(prefix="/api/learning", tags=["learning"])


class LearningEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    type: Literal["lesson", "sign", "favorite", "practice", "quiz"]
    id: str = Field(min_length=1, max_length=120)
    event_id: UUID | None = Field(default=None, strict=False)
    state: Literal["in_progress", "completed"] | None = None
    on: bool | None = None
    checklist: dict[str, bool] | None = None
    score: int | None = None
    total: int | None = None


def streak_for(activities: list[dict], now: datetime | None = None) -> dict:
    today = (now or datetime.now(UTC)).astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    counts: dict[date, int] = {}
    for activity in activities:
        if activity.get("type") not in ("lesson", "practice", "quiz"):
            continue
        day = datetime.fromisoformat(activity["at"].replace("Z", "+00:00"))
        key = day.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).date()
        if key <= today:
            counts[key] = counts.get(key, 0) + 1
    longest = run = 0
    previous = None
    for day in sorted(counts):
        run = run + 1 if previous and day == previous + timedelta(days=1) else 1
        longest = max(longest, run)
        previous = day
    cursor = today if today in counts else today - timedelta(days=1)
    current = 0
    while cursor in counts:
        current += 1
        cursor -= timedelta(days=1)
    return {
        "current": current,
        "longest": longest,
        "timezone": "Asia/Ho_Chi_Minh",
        "days": [
            {
                "date": (day := today - timedelta(days=29 - i)).isoformat(),
                "count": counts.get(day, 0),
            }
            for i in range(30)
        ],
    }


def validate_event(body: LearningEvent):
    content = legacy.app_modules.content
    if body.type in ("lesson", "quiz"):
        if body.id != "video":
            lesson = content.lesson(body.id)
            if not lesson or not content.is_open(lesson):
                raise sb.SupabaseError(422, "invalid_learning_event")
        elif body.type != "quiz":
            raise sb.SupabaseError(422, "invalid_learning_event")
    elif not content.sign(body.id):
        raise sb.SupabaseError(422, "invalid_learning_event")
    invalid = (
        (body.type == "lesson" and body.state is None)
        or (body.type == "favorite" and body.on is None)
        or (body.type in ("practice", "quiz") and body.event_id is None)
    )
    if body.type == "practice":
        keys = {"handshape", "location", "orientation", "movement", "expression"}
        invalid |= body.checklist is None or set(body.checklist) != keys
    if body.type == "quiz":
        candidates = content.signs() if body.id == "video" else content.signs(int(body.id))
        total = sum(bool(sign.get("video")) for sign in candidates)
        invalid |= (
            body.total != total or total == 0 or body.score is None or not 0 <= body.score <= total
        )
    if invalid:
        raise sb.SupabaseError(422, "invalid_learning_event")


@router.get("/state")
async def state(request: Request, response: Response):
    who = await sb.identity(request)
    snapshot = await sb.rpc("sh_learning_snapshot", who)
    snapshot["user"] = sb.public_user(who.user)
    snapshot["streak"] = streak_for(snapshot.get("activities", []))
    if who.refreshed:
        sb.set_session(response, request, who.refreshed)
    return snapshot


@router.post("/events")
async def event(body: LearningEvent, request: Request, response: Response):
    sb.same_origin(request)
    who = await sb.identity(request)
    validate_event(body)
    if request.headers.get("x-sh-user") != who.user["id"]:
        raise sb.SupabaseError(409, "account_changed")
    await sb.rpc("sh_record_learning_event", who, {"event": body.model_dump(mode="json")})
    if who.refreshed:
        sb.set_session(response, request, who.refreshed)
    return {"saved": True}
