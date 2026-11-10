"""Independent local inference API. No OAuth callbacks or database access."""

import asyncio
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings
from .inference import InferencePool
from .security import authorize
from .siformer_loader import RuntimeFailure

MAX_BYTES = 20 * 1024 * 1024
SAFE_ERRORS = {
    "cpu_placement_failed",
    "checkpoint_invalid",
    "source_integrity_failed",
    "tensorflow_version_mismatch",
    "landmark_python_missing",
    "invalid_video",
    "landmark_initialization_failed",
    "landmark_failed",
    "no_landmarks",
    "inference_failed",
    "request_timeout",
    "worker_unavailable",
    "configuration_missing",
    "model_initialization_failed",
    "initializing",
}


def create_app(settings=None, pool_factory=InferencePool):
    settings = settings or Settings()
    pool = pool_factory(settings)

    @asynccontextmanager
    async def lifespan(app):
        if (
            len(settings.ai_token_secret.get_secret_value().encode()) < 32
            or not settings.ai_allowed_origins
        ):
            pool.stop("configuration_missing")
        else:
            try:
                await asyncio.wait_for(asyncio.to_thread(pool.start), timeout=90)
            except (Exception, asyncio.CancelledError) as error:
                reason = (
                    str(error)
                    if isinstance(error, RuntimeFailure)
                    else "model_initialization_failed"
                )
                pool.stop(
                    reason if reason in SAFE_ERRORS else "model_initialization_failed"
                )
        try:
            yield
        finally:
            pool.stop()

    app = FastAPI(
        title="SignHearing SiFormer",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.pool = pool
    app.state.lock = asyncio.Lock()
    app.state.used = {}
    app.state.last_request = {}
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ai_allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=300,
    )

    @app.middleware("http")
    async def private_response(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request, error):
        return JSONResponse(
            {"success": False, "error": {"code": error.detail}},
            status_code=error.status_code,
        )

    @app.exception_handler(Exception)
    async def internal_error(request, error):
        return JSONResponse(
            {"success": False, "error": {"code": "inference_failed"}}, status_code=500
        )

    @app.get("/health")
    async def health():
        return {"status": "alive", "model_name": "SiFormer"}

    @app.get("/ready")
    async def ready():
        available = pool.available()
        reason = pool.error if pool.error in SAFE_ERRORS else "worker_unavailable"
        return JSONResponse(
            {
                "ready": available,
                "model_name": "SiFormer",
                "device": pool.device if available else None,
                "error": None if available else reason,
            },
            status_code=200 if available else 503,
        )

    @app.post("/infer")
    async def infer(request: Request, claims=Depends(authorize)):
        if not pool.available():
            raise HTTPException(503, "ai_unavailable")
        if app.state.lock.locked():
            raise HTTPException(429, "inference_busy")
        mime = request.headers.get("content-type", "").split(";")[0]
        if mime not in ("video/mp4", "video/webm", "application/json"):
            raise HTTPException(415, "unsupported_video")
        try:
            length = int(request.headers.get("content-length", "0"))
        except ValueError:
            raise HTTPException(400, "invalid_video") from None
        if length < 0 or length > MAX_BYTES:
            raise HTTPException(413, "video_too_large")
        now = time.time()
        app.state.used = {
            j: expiry for j, expiry in app.state.used.items() if expiry > now
        }
        app.state.last_request = {
            u: at for u, at in app.state.last_request.items() if at > now - 120
        }
        if claims["jti"] in app.state.used:
            raise HTTPException(401, "token_already_used")
        if (
            now - app.state.last_request.get(claims["sub"], 0) < 3
            or len(app.state.used) >= 2000
        ):
            raise HTTPException(429, "rate_limited")
        async with app.state.lock:
            app.state.used[claims["jti"]] = claims["exp"]
            app.state.last_request[claims["sub"]] = now
            started = time.perf_counter()
            with tempfile.TemporaryDirectory(prefix="signhearing-infer-") as directory:
                video = Path(directory) / ({"video/mp4": "clip.mp4", "video/webm": "clip.webm", "application/json": "frames.json"}[mime])
                size = 0
                try:
                    async with asyncio.timeout(settings.ai_upload_timeout):
                        with video.open("wb") as stream:
                            async for chunk in request.stream():
                                size += len(chunk)
                                if size > MAX_BYTES:
                                    raise HTTPException(413, "video_too_large")
                                stream.write(chunk)
                except TimeoutError:
                    raise HTTPException(408, "upload_timeout") from None
                with video.open("rb") as stream:
                    header = stream.read(16)
                if not size or (mime != "application/json" and not (
                    header[4:8] == b"ftyp" or header.startswith(b"\x1aE\xdf\xa3")
                )):
                    raise HTTPException(400, "invalid_video")
                try:
                    result = await asyncio.wait_for(
                        asyncio.to_thread(pool.run, video, directory),
                        settings.ai_request_timeout,
                    )
                except TimeoutError:
                    # Killing both workers bounds real work and releases file handles.
                    pool.stop("request_timeout")
                    raise HTTPException(504, "request_timeout") from None
                except asyncio.CancelledError:
                    pool.stop("request_timeout")
                    raise
                except RuntimeFailure as error:
                    reason = str(error)
                    if reason not in ("invalid_video", "no_landmarks"):
                        pool.stop(
                            reason if reason in SAFE_ERRORS else "inference_failed"
                        )
                    raise HTTPException(
                        422 if reason in ("invalid_video", "no_landmarks") else 503,
                        reason if reason in SAFE_ERRORS else "inference_failed",
                    ) from None
                result["expected_gloss"] = claims["expected_gloss"]
                result["matches_expected"] = (
                    result["predicted_gloss"] == claims["expected_gloss"]
                )
                result["total_request_time_ms"] = round(
                    (time.perf_counter() - started) * 1000, 2
                )
                return result

    return app


app = create_app()
