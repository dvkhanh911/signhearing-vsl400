from unittest.mock import AsyncMock

import pytest

from app.services import supabase as sb


@pytest.fixture
def verified_identity(monkeypatch):
    """Renderer regression tests use a verified identity, never production auth bypasses."""
    who = sb.Identity("test-token", {"id": "11111111-1111-4111-8111-111111111111"})
    monkeypatch.setattr(sb, "identity", AsyncMock(return_value=who))
    return who
