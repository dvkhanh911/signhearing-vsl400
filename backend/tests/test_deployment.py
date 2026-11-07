"""A deployed service must run without access to the parent repository."""

import os
import shutil
import subprocess
import sys

from app.services import legacy
from scripts.prepare_legacy import BACKEND, REPOSITORY, prepare


def test_local_renderer_keeps_using_editable_repository_sources():
    assert legacy.ROOT == REPOSITORY


def test_isolated_backend_bundle_contains_all_learning_routes_and_media(tmp_path):
    backend = tmp_path / "backend"
    shutil.copytree(BACKEND / "app", backend / "app", ignore=shutil.ignore_patterns("__pycache__"))
    bundle = prepare(backend=backend)
    # Rebuilds must remove files left behind by an older deployment.
    stale = bundle / "old-module.txt"
    stale.write_text("outdated", encoding="utf-8")
    prepare(backend=backend)
    assert not stale.exists()
    assert not (bundle / "modules/review/tests").exists()
    assert not (bundle / ".env").exists()
    environment = dict(os.environ, VERCEL="1")
    environment.pop("DATABASE_URL", None)
    check = r"""
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from fastapi.testclient import TestClient
from app.main import create_app
from app.services import legacy
import serve
expected = Path(sys.argv[1]) / 'legacy_site'
assert legacy.ROOT == expected
assert Path(serve.__file__).parent == expected
routes = ['/app', '/app/courses', '/app/lessons/1', '/app/dictionary',
          '/app/signs/am', '/app/practice', '/app/practice/am', '/app/review',
          '/app/review/quiz/1', '/app/progress', '/app/settings', '/app/account', '/login']
with TestClient(create_app(), base_url='https://signhearing.vercel.app') as client:
    assert client.get('/api/health').json()['status'] == 'ok'
    for locale in ('vi', 'en'):
        for route in routes:
            response = client.get(route + '?lang=' + locale)
            assert response.status_code == 200, (route, response.text)
            assert response.headers['content-language'] == locale
            assert '{{' not in response.text
            assert 'Secure' in response.headers['set-cookie']
        assert client.get('/app/lessons/999?lang=' + locale).status_code == 404
    for asset in ['/static/login.js', '/static/app/onboarding.js', '/static/m/review/style.css']:
        assert client.get(asset).status_code == 200, asset
    video = client.get('/static/media/local-videos/am.mp4', headers={'Range': 'bytes=0-31'})
    assert video.status_code == 206 and len(video.content) == 32
print('PASS: packaged backend, 26 translated pages, HTTPS cookies, assets and video ranges.')
"""
    result = subprocess.run(
        [sys.executable, "-I", "-c", check, str(backend)],
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr
