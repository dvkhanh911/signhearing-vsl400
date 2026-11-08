from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response

from app.services import legacy
from app.services import supabase as sb

router = APIRouter(include_in_schema=False)


def locale_for(request: Request) -> str:
    query = request.query_params.get("lang")
    cookie = request.cookies.get("signhearing_language")
    return query if query in ("vi", "en") else "en" if cookie == "en" else "vi"


def page_response(request: Request, path: str) -> HTMLResponse:
    locale = locale_for(request)
    # Unknown paths never enter template URLs.
    canonical = path if path == "/login" or legacy.app_modules.is_app_path(path) else "/404"
    body, status = legacy.render(locale, canonical)
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
                "base-uri 'self'; form-action 'none'"
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
    response = page_response(request, "/app/" + path if path else "/app")
    if who.refreshed:
        sb.set_session(response, request, who.refreshed)
    if request.method == "HEAD":
        response.body = b""
    return response


@router.api_route("/static/{path:path}", methods=["GET", "HEAD"])
def static_asset(request: Request, path: str) -> Response:
    candidate = legacy.static_file("/static/" + path)
    if candidate:
        return FileResponse(candidate, headers={"Cache-Control": "no-cache"})
    return page_response(request, "/404")
