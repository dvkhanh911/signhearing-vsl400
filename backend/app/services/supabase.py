"""One Supabase Auth session shared by Next.js and the legacy renderer.

Only publishable credentials are used; database requests carry the verified user's
access token so PostgreSQL RLS remains the final authorization boundary.
"""

from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx
from fastapi import Request, Response

from app.core.config import get_settings

ACCESS_COOKIE = "sh_access"
REFRESH_COOKIE = "sh_refresh"


class SupabaseError(Exception):
    def __init__(self, status: int, code: str):
        self.status = status
        self.code = code


async def call(method: str, path: str, *, token: str = "", payload=None):
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise SupabaseError(503, "supabase_not_configured")
    headers = {"apikey": settings.supabase_publishable_key}
    if token:
        headers["Authorization"] = "Bearer " + token
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            result = await client.request(
                method, settings.supabase_url + path, headers=headers, json=payload
            )
    except httpx.HTTPError as error:
        raise SupabaseError(503, "supabase_unavailable") from error
    if result.is_error:
        try:
            body = result.json()
            code = body.get("code", body.get("error_code", ""))
        except ValueError:
            code = ""
        known = {
            "invalid_credentials",
            "email_exists",
            "user_already_exists",
            "weak_password",
            "email_not_confirmed",
            "over_request_rate_limit",
            "over_email_send_rate_limit",
            "signup_disabled",
        }
        if path.startswith("/rest/"):
            raise SupabaseError(503, "learning_unavailable")
        if result.status_code == 429:
            raise SupabaseError(429, "rate_limited")
        raise SupabaseError(
            401 if result.status_code in (400, 401, 403, 422) else 503,
            code if code in known else "authentication_failed",
        )
    return result.json() if result.content else None


def same_origin(request: Request):
    """Cookie mutations require an explicit same-origin JSON request (also blocks login CSRF)."""
    origin = request.headers.get("origin", "")
    parsed = urlsplit(origin)
    settings = get_settings()
    # Local Next.js rewrites send the backend Host while retaining the browser Origin.
    local_proxy = (
        settings.app_env == "development"
        and parsed.hostname in ("localhost", "127.0.0.1")
        and request.url.hostname in ("localhost", "127.0.0.1")
        and origin in settings.cors_origins
    )
    # Vercel's trusted edge can forward the public host to the backend service.
    from os import environ

    edge_host = request.headers.get("x-forwarded-host", "") if environ.get("VERCEL") == "1" else ""
    expected = parsed.netloc == request.url.netloc or (edge_host and parsed.netloc == edge_host)
    if (
        not origin
        or parsed.scheme not in ("http", "https")
        or not (expected or local_proxy)
        or request.headers.get("sec-fetch-site") == "cross-site"
        or request.headers.get("content-type", "").split(";")[0] != "application/json"
    ):
        raise SupabaseError(403, "origin_rejected")


def set_session(response: Response, request: Request, session: dict):
    # Host-only cookies, HTTPS on Vercel, inaccessible to browser JavaScript.
    secure = request.url.scheme == "https" or get_settings().app_env == "production"
    for name, value, age in (
        (ACCESS_COOKIE, session["access_token"], int(session.get("expires_in", 3600))),
        (REFRESH_COOKIE, session["refresh_token"], 60 * 60 * 24 * 30),
    ):
        response.set_cookie(
            name, value, max_age=age, path="/", httponly=True, secure=secure, samesite="lax"
        )


def clear_session(response: Response):
    for name in (ACCESS_COOKIE, REFRESH_COOKIE, "signhearing_demo_auth", "signhearing_demo_user"):
        response.delete_cookie(name, path="/")


@dataclass
class Identity:
    token: str
    user: dict
    refreshed: dict | None = None


async def identity(request: Request) -> Identity:
    bearer = request.headers.get("authorization", "")
    token = bearer[7:] if bearer.startswith("Bearer ") else request.cookies.get(ACCESS_COOKIE, "")
    if token:
        try:
            user = await call("GET", "/auth/v1/user", token=token)
            return Identity(token, user)
        except SupabaseError as error:
            if error.status != 401:
                raise
    refresh = request.cookies.get(REFRESH_COOKIE)
    if not refresh or bearer:
        raise SupabaseError(401, "session_required")
    session = await call(
        "POST", "/auth/v1/token?grant_type=refresh_token", payload={"refresh_token": refresh}
    )
    # Never trust a decoded JWT or a browser-supplied user ID.
    user = await call("GET", "/auth/v1/user", token=session["access_token"])
    return Identity(session["access_token"], user, session)


def public_user(user: dict) -> dict:
    return {key: user.get(key) for key in ("id", "email", "created_at", "user_metadata")}


async def rpc(name: str, who: Identity, payload=None):
    return await call("POST", "/rest/v1/rpc/" + name, token=who.token, payload=payload or {})
