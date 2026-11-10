"""Validate the shared inference capability, exact browser origin and replay limits."""

from fastapi import HTTPException, Request

from backend.app.services.ai_tokens import InvalidCapability, verify


def authorize(request: Request):
    settings = request.app.state.settings
    origin = request.headers.get("origin", "")
    if origin not in settings.ai_allowed_origins:
        raise HTTPException(403, "origin_not_allowed")
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(401, "unauthorized")
    try:
        return verify(header[7:], settings.ai_token_secret.get_secret_value(), origin)
    except InvalidCapability:
        raise HTTPException(401, "unauthorized") from None
