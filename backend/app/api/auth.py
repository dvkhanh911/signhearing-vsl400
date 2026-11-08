from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services import supabase as sb

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.get("/config")
async def config():
    from app.core.config import get_settings

    settings = get_settings()
    return {"url": settings.supabase_url, "publishable_key": settings.supabase_publishable_key}


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        value = value.strip()
        if "@" not in value or any(c.isspace() for c in value):
            raise ValueError("Invalid email")
        return value


class Registration(Credentials):
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=80)


@router.post("/register")
async def register(body: Registration, request: Request, response: Response):
    sb.same_origin(request)
    session = await sb.call(
        "POST",
        "/auth/v1/signup",
        payload={
            "email": body.email,
            "password": body.password,
            "data": {"display_name": body.display_name.strip()},
        },
    )
    if not session.get("access_token"):
        # No fake email flow: explicitly report a project configured differently from MVP.
        raise sb.SupabaseError(409, "email_confirmation_required")
    sb.set_session(response, request, session)
    return {"user": sb.public_user(session["user"])}


@router.post("/login")
async def login(body: Credentials, request: Request, response: Response):
    sb.same_origin(request)
    session = await sb.call("POST", "/auth/v1/token?grant_type=password", payload=body.model_dump())
    sb.set_session(response, request, session)
    return {"user": sb.public_user(session["user"])}


@router.get("/session")
async def session(request: Request, response: Response):
    who = await sb.identity(request)
    if who.refreshed:
        sb.set_session(response, request, who.refreshed)
    return {"user": sb.public_user(who.user)}


@router.post("/logout")
async def logout(request: Request):
    sb.same_origin(request)
    response = Response(status_code=204)
    try:
        who = await sb.identity(request)
        await sb.call("POST", "/auth/v1/logout?scope=local", token=who.token)
    except sb.SupabaseError as error:
        if error.status != 401:
            raise
    sb.clear_session(response)
    return response
