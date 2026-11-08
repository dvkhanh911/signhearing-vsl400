import logging
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.services.supabase import SupabaseError

logger = logging.getLogger(__name__)


def error_response(request: Request, status: int, code: str, message: str) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid4()))
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "request_id": request_id}},
        headers={"X-Request-ID": request_id},
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(SupabaseError)
    async def supabase_error(request: Request, exc: SupabaseError) -> JSONResponse:
        return error_response(request, exc.status, exc.code, exc.code)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        message = (
            "Resource not found" if exc.status_code == 404 else "Request could not be completed"
        )
        return error_response(request, exc.status_code, f"http_{exc.status_code}", message)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(request, 422, "validation_error", "Invalid request")

    @app.exception_handler(Exception)
    async def internal_error(request: Request, exc: Exception) -> JSONResponse:
        # Do not log request bodies, SQL parameters, URLs containing secrets or exception text.
        logger.error("Unhandled %s request_id=%s", type(exc).__name__, request.state.request_id)
        return error_response(request, 500, "internal_error", "An internal error occurred")
