from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response

from app.api.progress import snapshot_for
from app.core.config import get_settings
from app.core.timing import measure
from app.services import legacy
from app.services import supabase as sb

router = APIRouter(include_in_schema=False)


def locale_for(request: Request) -> str:
    query = request.query_params.get("lang")
    cookie = request.cookies.get("signhearing_language")
    return query if query in ("vi", "en") else "en" if cookie == "en" else "vi"


def page_response(request: Request, path: str, initial_state: dict | None = None) -> HTMLResponse:
    locale = locale_for(request)
    # Unknown paths never enter template URLs.
    canonical = path if path == "/login" or legacy.app_modules.is_app_path(path) else "/404"
    ai_origin = get_settings().ai_api_url if path.startswith("/app/practice/") else ""
    connect_policy = "connect-src 'self'" + (" " + ai_origin if ai_origin else "") + ";"
    with measure("render"):
        body, status = legacy.render(locale, canonical, initial_state=initial_state)
    response = HTMLResponse(
        body,
        status_code=status,
        headers={
            "Content-Language": locale,
            "Cache-Control": "private, no-store",
            "Vary": "Cookie",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "same-origin",
            "Content-Security-Policy": (
                "default-src 'self'; script-src 'self'; style-src 'self'; "
                "img-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; "
                "base-uri 'self'; form-action 'none'; " + connect_policy
            ),
        },
    )
    response.set_cookie(
        "signhearing_language",
        locale,
        max_age=31536000,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
    )
    return response


@router.api_route("/login", methods=["GET", "HEAD"])
def login_page(request: Request) -> Response:
    response = page_response(request, "/login")
    if request.method == "HEAD":
        response.body = b""
    return response


@router.api_route("/app", methods=["GET", "HEAD"])
@router.api_route("/app/{path:path}", methods=["GET", "HEAD"])
async def learning_page(request: Request, path: str = "") -> Response:
    try:
        who = await sb.identity(request)
    except sb.SupabaseError as error:
        if error.status != 401:
            raise
        from urllib.parse import urlencode

        response = RedirectResponse(
            "/login?"
            + urlencode(
                {
                    "lang": locale_for(request),
                    "next": request.url.path
                    + ("?" + request.url.query if request.url.query else ""),
                }
            ),
            status_code=303,
        )
        sb.clear_session(response)
        return response
    target = "/app/" + path if path else "/app"
    initial_state = None
    if legacy.app_modules.is_app_path(target):
        try:
            # Reuse the identity already verified for this navigation. The browser
            # must not repeat auth + snapshot requests before showing every page.
            initial_state = await snapshot_for(who)
        except sb.SupabaseError as error:
            # Keep the existing retry/sign-out screen available during an outage.
            initial_state = {"error": error.code}
    response = page_response(request, target, initial_state=initial_state)
    if who.refreshed:
        sb.set_session(response, request, who.refreshed)
    if request.method == "HEAD":
        response.body = b""
    return response


@router.api_route("/static/{path:path}", methods=["GET", "HEAD"])
def static_asset(request: Request, path: str) -> Response:
    candidate = legacy.static_file("/static/" + path)
    if candidate:
        cache = "no-cache"
        version = request.query_params.get("v")
        if version and candidate.suffix != ".mp4" and version == legacy.asset_version(candidate):
            cache = "public, max-age=31536000, immutable"
        return FileResponse(candidate, headers={"Cache-Control": cache})
    return page_response(request, "/404")
