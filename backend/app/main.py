import logging
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api import ai, auth, health, learning, progress
from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.core.timing import measure, request_timings, server_timing
from app.db.session import get_engine
from app.services import supabase as sb
from app.services.oauth import RedactCallbackQuery

logging.getLogger("uvicorn.access").addFilter(RedactCallbackQuery())


@asynccontextmanager
async def lifespan(app: FastAPI):
    # No connection, schema creation or seed at application startup.
    async with sb.client_scope() as client:
        app.state.supabase_client = client
        try:
            yield
        finally:
            app.state.supabase_client = None
    if get_engine.cache_info().currsize:
        get_engine().dispose()
        get_engine.cache_clear()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="SignHearing API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "HEAD", "OPTIONS", "POST"],
        allow_headers=["Content-Type", "Authorization", "X-SH-User"],
    )

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        request.state.request_id = str(uuid4())
        with request_timings() as timings:
            with measure("app"):
                if request.url.path == "/app" or request.url.path.startswith(
                    ("/app/", "/api/auth/", "/api/learning/", "/api/ai/")
                ):
                    # Some serverless adapters do not run ASGI lifespan. In that
                    # case still reuse one client for auth + data in this request.
                    async with sb.client_scope(getattr(app.state, "supabase_client", None)):
                        response = await call_next(request)
                else:
                    response = await call_next(request)
            response.headers["Server-Timing"] = server_timing(timings)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        if request.url.path.startswith("/api/auth/") or request.url.path.startswith(
            ("/api/learning/", "/api/ai/")
        ):
            response.headers["Cache-Control"] = "private, no-store"
            response.headers["Vary"] = "Cookie, Authorization"
        return response

    install_error_handlers(app)
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(progress.router)
    app.include_router(learning.router)
    app.include_router(ai.router)
    return app


app = create_app()
