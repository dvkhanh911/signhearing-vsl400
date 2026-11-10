"""API plumbing stubs do not verify the model or establish benchmark results."""

import json
import threading

import pytest
from fastapi.testclient import TestClient

from ai_inference.app.config import Settings
from ai_inference.app.main import MAX_BYTES, create_app
from ai_inference.app.siformer_loader import RuntimeFailure
from backend.app.services.ai_tokens import (
    InvalidCapability,
    _encode,
    _signature,
    issue,
    verify,
)

ORIGIN = "https://signhearing.test"
SECRET = "test-only-signing-key-with-at-least-32-bytes"
MP4_HEADER = b"\x00\x00\x00\x18ftypisom\x00\x00\x00\x00"


class StubPool:
    def __init__(self, settings):
        self.ready, self.error, self.device = False, "initializing", "CPU"
        self.paths = []
        self.block = False
        self.stopped = threading.Event()

    def start(self):
        self.ready = True

    def stop(self, error="worker_unavailable"):
        self.ready, self.error = False, error
        self.stopped.set()

    def available(self):
        return self.ready

    def run(self, video, directory):
        self.paths.append(video)
        assert video.exists()
        if self.block:
            self.stopped.wait(timeout=3)
        if video.read_bytes().endswith(b"corrupt"):
            raise RuntimeFailure("invalid_video")
        return {
            "success": True,
            "predicted_gloss": "fixture",
            "confidence": 0.5,
            "inference_time_ms": 1,
            "model_name": "SiFormer",
            "device": "CPU",
        }


@pytest.fixture
def client():
    settings = Settings(
        ai_token_secret=SECRET,
        ai_allowed_origins=[ORIGIN],
        ai_request_timeout=1,
        _env_file=None,
    )
    app = create_app(settings, pool_factory=StubPool)
    with TestClient(app) as client:
        yield client


def headers(subject="learner", origin=ORIGIN):
    return {
        "Origin": origin,
        "Content-Type": "video/mp4",
        "Authorization": "Bearer " + issue(SECRET, subject, origin, "fixture"),
    }


def test_valid_request_single_use_token_and_cleanup(client):
    auth = headers()
    response = client.post("/infer", content=MP4_HEADER, headers=auth)
    assert response.status_code == 200
    assert response.json()["matches_expected"] is True
    assert not client.app.state.pool.paths[0].exists()
    assert client.post("/infer", content=MP4_HEADER, headers=auth).status_code == 401


def test_frames_require_same_auth_and_are_removed(client):
    auth = headers("frames")
    auth["Content-Type"] = "application/json"
    assert client.post("/infer", content=b'{"frames":[]}', headers={"Origin": ORIGIN, "Content-Type": "application/json"}).status_code == 401
    assert client.post("/infer", content=b'{"frames":[]}', headers=auth).status_code == 200
    assert not client.app.state.pool.paths[-1].exists()
    assert client.post("/infer", content=b'{"frames":[]}', headers=auth).status_code == 401


def test_unauthorized_size_and_corrupt_uploads(client):
    assert (
        client.post(
            "/infer", content=MP4_HEADER, headers={"Origin": ORIGIN}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/infer", content=MP4_HEADER, headers=headers(origin="https://evil.test")
        ).status_code
        == 403
    )
    auth = headers()
    auth["Content-Length"] = str(MAX_BYTES + 1)
    assert client.post("/infer", content=MP4_HEADER, headers=auth).status_code == 413
    assert (
        client.post(
            "/infer", content=b"invalid", headers=headers("invalid-header")
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/infer", content=MP4_HEADER + b"corrupt", headers=headers("corrupt")
        ).status_code
        == 422
    )
    assert all(not p.exists() for p in client.app.state.pool.paths)


def test_timeout_stops_worker_and_removes_files(client):
    pool = client.app.state.pool
    pool.block = True
    response = client.post("/infer", content=MP4_HEADER, headers=headers())
    assert response.status_code == 504
    assert pool.stopped.is_set()
    assert client.get("/ready").status_code == 503
    assert all(not p.exists() for p in pool.paths)
    assert client.get("/health").status_code == 200


def test_rate_limit_cors_and_readiness(client):
    assert client.get("/ready").json()["device"] == "CPU"
    assert (
        client.post("/infer", content=MP4_HEADER, headers=headers()).status_code == 200
    )
    assert (
        client.post("/infer", content=MP4_HEADER, headers=headers()).status_code == 429
    )
    client.app.state.pool.ready = False
    assert (
        client.post("/infer", content=MP4_HEADER, headers=headers("other")).status_code
        == 503
    )
    response = client.options(
        "/infer",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert "C:" not in client.get("/ready").text


def test_signature_expiry_issuer_audience_scope():
    token = issue(SECRET, "learner", ORIGIN, "fixture")
    claims = verify(token, SECRET, ORIGIN)
    with pytest.raises(InvalidCapability):
        verify(token + "tampered", SECRET, ORIGIN)
    with pytest.raises(InvalidCapability):
        verify(token, SECRET, ORIGIN, now=claims["exp"])
    with pytest.raises(InvalidCapability):
        verify(token, SECRET, "https://evil.test")
    for field in ("iss", "aud", "scope"):
        payload = _encode(json.dumps(dict(claims, **{field: "wrong"})).encode())
        bad = "v1." + payload + "." + _signature(payload, SECRET)
        with pytest.raises(InvalidCapability):
            verify(bad, SECRET, ORIGIN)
