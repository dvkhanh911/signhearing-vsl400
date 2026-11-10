"""AI access reuses sessions; unavailable inference cannot log users out."""

from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.api import ai
from app.core.config import Settings
from app.main import create_app
from app.services import ai_tokens
from app.services import supabase as sb

SECRET = "test-only-capability-signing-key-32-bytes"
ORIGIN = "https://testserver"


@pytest.fixture
def ai_settings(monkeypatch):
    settings = Settings(
        ai_api_url="https://classroom.trycloudflare.com", ai_token_secret=SECRET, _env_file=None
    )
    monkeypatch.setattr(ai, "get_settings", lambda: settings)
    monkeypatch.setattr("app.api.learning.get_settings", lambda: settings)
    return settings


def test_verified_session_issues_origin_bound_short_lived_token(verified_identity, ai_settings):
    with TestClient(create_app(), base_url=ORIGIN) as client:
        response = client.post("/api/ai/token", json={"slug": "an"}, headers={"Origin": ORIGIN})
        assert response.status_code == 200
        data = response.json()
        claims = ai_tokens.verify(data["token"], SECRET, ORIGIN)
        assert claims["sub"] == verified_identity.user["id"]
        assert claims["expected_gloss"] in ai.LABELS
        assert claims["exp"] - claims["iat"] == 120
        assert data["endpoint"] == "https://classroom.trycloudflare.com/infer"
        assert SECRET not in response.text
        assert "no-store" in response.headers["cache-control"]


def test_ai_failure_and_unknown_label_keep_authentication(
    verified_identity, ai_settings, monkeypatch
):
    monkeypatch.setattr(ai, "get_settings", lambda: Settings(_env_file=None))
    with TestClient(create_app(), base_url=ORIGIN) as client:
        for slug, expected in (("an", 503), ("xin-chao", 422), ("unknown", 404)):
            response = client.post("/api/ai/token", json={"slug": slug}, headers={"Origin": ORIGIN})
            assert response.status_code == expected
            assert "set-cookie" not in response.headers
        assert client.get("/api/auth/session").status_code == 200
        assert client.get("/app/lessons/8").status_code == 200


def test_token_requires_verified_session_and_same_origin(ai_settings, monkeypatch):
    monkeypatch.setattr(
        sb, "identity", AsyncMock(side_effect=sb.SupabaseError(401, "unauthorized"))
    )
    with TestClient(create_app(), base_url=ORIGIN) as client:
        assert (
            client.post(
                "/api/ai/token", json={"slug": "an"}, headers={"Origin": ORIGIN}
            ).status_code
            == 401
        )
        assert (
            client.post(
                "/api/ai/token", json={"slug": "an"}, headers={"Origin": "https://evil.invalid"}
            ).status_code
            == 403
        )


def test_only_practice_csp_allows_tunnel(verified_identity, ai_settings):
    with TestClient(create_app(), base_url=ORIGIN) as client:
        assert (
            ai_settings.ai_api_url
            in client.get("/app/practice/an").headers["content-security-policy"]
        )
        assert ai_settings.ai_api_url not in client.get("/login").headers["content-security-policy"]
        assert client.get("/api/auth/google/callback", follow_redirects=False).status_code == 303


@pytest.mark.parametrize(
    "url",
    [
        "https://ok.test;script-src",
        "https://ok.test/path",
        "https://u:p@ok.test",
        "javascript:alert(1)",
    ],
)
def test_ai_origin_rejects_csp_and_url_injection(url):
    with pytest.raises(ValueError):
        Settings(ai_api_url=url, _env_file=None)
