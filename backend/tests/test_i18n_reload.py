"""Translation JSON and templates must stay in sync in a long-running renderer."""
import json
from importlib import import_module
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

# Import after the app's legacy adapter has added the repository root to sys.path.
i18n = import_module("i18n")


def write_translations(root, folder, locale, values):
    path = root / folder / (locale + ".json")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(values), encoding="utf-8")


@pytest.fixture
def translations(tmp_path, monkeypatch):
    monkeypatch.setattr(i18n, "ROOT", tmp_path)
    monkeypatch.setattr(i18n, "DICTIONARIES", {})
    monkeypatch.setattr(i18n, "LOCALE_OWNERS", {})
    monkeypatch.setattr(i18n, "_LOCALE_SIGNATURE", ())
    for locale in ("vi", "en"):
        write_translations(tmp_path, "locales", locale, {"site.name": "Test"})
        write_translations(tmp_path, "app_shell/locales", locale, {"shell.label": locale})
        write_translations(tmp_path, "modules/example/locales", locale, {"example.label": locale})
    i18n.refresh_locales()
    return tmp_path


def test_app_request_refreshes_stale_tour_translations(monkeypatch, verified_identity):
    # Reproduce a worker started before the new template's translation keys existed.
    for locale in ("vi", "en"):
        monkeypatch.delitem(i18n.DICTIONARIES[locale], "shell.tour.restart")
    monkeypatch.setattr(i18n, "_LOCALE_SIGNATURE", ())
    with TestClient(create_app()) as client:
        for locale in ("vi", "en"):
            response = client.get("/app?lang=" + locale)
            assert response.status_code == 200
            assert 'data-tour-start' in response.text
            assert 'data-tour="dashboard"' in response.text
            assert i18n.DICTIONARIES[locale]["shell.tour.restart"] in response.text


def test_changed_translations_keep_imports_and_request_snapshots_valid(translations):
    imported = i18n.DICTIONARIES
    old_request = imported["vi"]
    for locale in ("vi", "en"):
        write_translations(
            translations, "app_shell/locales", locale,
            {"shell.label": "Updated " + locale, "shell.tour.restart": "Tour " + locale},
        )
    i18n.refresh_locales()
    assert imported is i18n.DICTIONARIES
    assert imported["vi"]["shell.tour.restart"] == "Tour vi"
    assert imported["en"]["shell.tour.restart"] == "Tour en"
    assert old_request["shell.label"] == "vi"
    assert "shell.tour.restart" not in old_request


def test_unchanged_translations_are_not_reparsed(translations):
    with patch.object(Path, "read_text", side_effect=AssertionError("Unexpected JSON reload")):
        i18n.refresh_locales()


def test_invalid_update_keeps_the_last_valid_cache(translations):
    old_request = i18n.DICTIONARIES["vi"]
    old_signature = i18n._LOCALE_SIGNATURE
    write_translations(
        translations, "modules/example/locales", "vi",
        {"example.label": "Updated", "example.new": "New"},
    )
    with pytest.raises(ValueError, match="Locale en"):
        i18n.refresh_locales()
    assert i18n.DICTIONARIES["vi"] is old_request
    assert "example.new" not in i18n.DICTIONARIES["vi"]
    assert i18n._LOCALE_SIGNATURE == old_signature
    write_translations(
        translations, "modules/example/locales", "en",
        {"example.label": "Updated", "example.new": "New"},
    )
    i18n.refresh_locales()
    assert i18n.DICTIONARIES["vi"]["example.new"] == "New"
