"""Issue short-lived inference capabilities using the existing verified session."""

import json

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from app.core.config import get_settings
from app.services import ai_tokens, legacy
from app.services import supabase as sb

router = APIRouter(prefix="/api/ai", tags=["AI inference"])
LABELS = json.loads((legacy.ROOT / "data/siformer-labels.json").read_text(encoding="utf-8"))


class TokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9-]+$")


@router.post("/token")
async def token(body: TokenRequest, request: Request, response: Response):
    sb.same_origin(request)
    who = await sb.identity(request)
    settings = get_settings()
    sign = legacy.app_modules.content.sign(body.slug)
    if not sign:
        raise sb.SupabaseError(404, "sign_not_found")
    # Diacritics carry meaning: compare the actual Vietnamese gloss, never class IDs
    # or an accent-stripped slug from the unrelated 400-word syllabus.
    gloss = sign.get("source_gloss") or sign["word"]["vi"]
    if gloss not in LABELS:
        raise sb.SupabaseError(422, "ai_sign_unsupported")
    if not settings.ai_api_url or len(settings.ai_token_secret.get_secret_value().encode()) < 32:
        raise sb.SupabaseError(503, "ai_unavailable")
    capability = ai_tokens.issue(
        settings.ai_token_secret.get_secret_value(),
        who.user["id"],
        request.headers["origin"],
        gloss,
    )
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Cookie, Origin"
    if who.refreshed:
        sb.set_session(response, request, who.refreshed)
    return {
        "token": capability,
        "expires_in": ai_tokens.TTL,
        "endpoint": settings.ai_api_url + "/infer",
        "expected_gloss": gloss,
        "max_bytes": 20 * 1024 * 1024,
        "max_duration_seconds": 12,
    }
