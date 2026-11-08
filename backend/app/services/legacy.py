"""Progressive migration adapter: reuse the team's existing modules without rewriting them.

This adapter calls pure rendering functions; authenticated data lives in app.api.progress.
Importing serve does not start its HTTP server. Page contexts refresh changed translation
files before rendering templates from the shared app shell.
"""

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
REPOSITORY = BACKEND.parent
BUNDLE = BACKEND / "legacy_site"
if os.environ.get("VERCEL") == "1" and (BUNDLE / "app_modules.py").is_file():
    ROOT = BUNDLE
elif (REPOSITORY / "app_modules.py").is_file():
    ROOT = REPOSITORY
else:
    ROOT = BUNDLE
if not (ROOT / "app_modules.py").is_file():
    raise RuntimeError(
        "Learning sources are missing. Run python scripts/prepare_legacy.py during build."
    )
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app_modules  # noqa: E402
from serve import page_context, render_page  # noqa: E402


def render(locale: str, path: str) -> tuple[str, int]:
    if path == "/login":
        return render_page(locale, "/login", "login").decode("utf-8"), 200
    if app_modules.is_app_path(path):
        try:
            return app_modules.render(
                locale, path.rstrip("/"), page_context(locale, path, "app")
            ), 200
        except app_modules.NotFound:
            pass
    return render_page(locale, "/404", "error").decode("utf-8"), 404


def static_file(path: str) -> Path | None:
    if path.startswith(("/static/app/", "/static/m/")):
        return app_modules.static_file(path)
    candidate = (ROOT / path.lstrip("/")).resolve()
    base = (ROOT / "static").resolve()
    allowed = {".css", ".js", ".png", ".svg", ".webp", ".woff2", ".mp4"}
    if candidate.is_relative_to(base) and candidate.suffix in allowed and candidate.is_file():
        return candidate
    return None
