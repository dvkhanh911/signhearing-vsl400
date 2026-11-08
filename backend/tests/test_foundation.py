import os
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.db.base import Base
from app.db.session import check_connection, get_engine
from app.main import create_app


@pytest.fixture
def client(verified_identity):
    with TestClient(create_app(), raise_server_exceptions=False) as current:
        yield current


def test_health_does_not_connect_to_database():
    with patch("app.db.session.create_engine", side_effect=AssertionError("must stay offline")):
        with TestClient(create_app()) as client:
            response = client.get("/api/health")
            assert response.status_code == 200
            assert response.json() == {"status": "ok", "service": "signhearing-api"}
            assert response.headers["x-request-id"]
    assert not Base.metadata.tables


def test_errors_are_consistent(client):
    response = client.get("/api/not-a-real-endpoint")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "http_404"
    assert error["request_id"] == response.headers["x-request-id"]
    assert "Traceback" not in response.text


def test_unexpected_errors_do_not_leak_details():
    app = create_app()

    @app.get("/test-failure")
    def fail():
        raise RuntimeError("secret-database-password")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/test-failure")
        assert response.status_code == 500
        assert "secret-database-password" not in response.text
        assert response.json()["error"]["request_id"] == response.headers["x-request-id"]


def test_development_cors(client):
    allowed = client.options(
        "/api/health",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    denied = client.options(
        "/api/health",
        headers={"Origin": "https://untrusted.invalid", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in denied.headers


def test_database_configuration_rejects_unintended_backends():
    with pytest.raises(ValidationError):
        Settings(database_url="sqlite:///unexpected.db", _env_file=None)
    settings = Settings(
        database_url="postgresql+psycopg://user:placeholder@localhost/test", _env_file=None
    )
    assert settings.database_url.startswith("postgresql+psycopg:")


@pytest.mark.parametrize("locale", ["vi", "en"])
@pytest.mark.parametrize(
    "route",
    [
        "/app",
        "/app/courses",
        "/app/lessons/1",
        "/app/dictionary",
        "/app/signs/am",
        "/app/practice",
        "/app/practice/am",
        "/app/review",
        "/app/review/quiz/1",
        "/app/progress",
        "/app/settings",
        "/app/account",
    ],
)
def test_existing_learning_routes(client, route, locale):
    response = client.get(route + "?lang=" + locale)
    assert response.status_code == 200
    assert f'<html lang="{locale}">' in response.text
    assert "/static/app/modern.css" in response.text
    assert 'id="sh-data"' in response.text
    assert response.headers["content-language"] == locale
    assert "{{" not in response.text
    head = client.head(route + "?lang=" + locale)
    assert head.status_code == 200
    assert not head.content
    assert head.headers["content-length"] == str(len(response.content))


def test_language_cookie_and_missing_page(client):
    client.get("/app?lang=en")
    response = client.get("/app/settings")
    assert response.headers["content-language"] == "en"
    missing = client.get("/app/lessons/999")
    assert missing.status_code == 404
    assert '<html lang="en">' in missing.text


@pytest.mark.parametrize("locale", ["vi", "en"])
def test_real_login_uses_the_existing_origin(client, locale):
    response = client.get(f"/login?lang={locale}&next=%2Fapp%2Faccount")
    assert response.status_code == 200
    assert response.headers["content-language"] == locale
    assert 'id="login-form"' in response.text
    assert 'id="login-username"' in response.text
    assert 'id="login-password"' in response.text
    assert "/static/login.js" in response.text
    assert "{{" not in response.text
    head = client.head(f"/login?lang={locale}")
    assert head.status_code == 200
    assert not head.content
    assert head.headers["content-length"] == str(len(response.content))
    assert client.get("/static/login.js").status_code == 200
    assert client.get("/static/login.css").status_code == 200


def test_static_paths_and_video_ranges(client):
    assert client.get("/static/app/modern.css").status_code == 200
    for path in ["/static/m/lesson/view.py", "/static/../serve.py", "/static/%2e%2e/serve.py"]:
        assert client.get(path).status_code == 404
    response = client.get("/static/media/local-videos/am.mp4", headers={"Range": "bytes=0-31"})
    assert response.status_code == 206
    assert len(response.content) == 32
    assert response.headers["content-range"].startswith("bytes 0-31/")


def test_migration_has_no_fabricated_business_tables():
    migration = Path("alembic/versions/0001_foundation.py").read_text()
    assert "create_table" not in migration
    assert "0001_foundation" in migration


@pytest.mark.database
@pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="PostgreSQL DATABASE_URL not configured")
def test_live_postgresql_connection():
    get_settings.cache_clear()
    get_engine.cache_clear()
    check_connection()
    get_engine().dispose()
