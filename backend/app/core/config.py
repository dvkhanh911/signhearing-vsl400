from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_ROOT / ".env", extra="ignore")
    app_env: str = "development"
    api_host: str = "127.0.0.1"
    api_port: int = Field(default=8001, ge=1, le=65535)
    # Empty by default: API/landing startup never needs a database or credentials.
    database_url: str = ""
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    # Reuse the frontend/deployment public origin; Vercel system URLs are fallback.
    site_url: str = ""
    ai_api_url: str = ""
    ai_token_secret: SecretStr = SecretStr("")

    @field_validator("ai_api_url")
    @classmethod
    def ai_origin(cls, value: str) -> str:
        import re
        from urllib.parse import urlsplit

        if not value:
            return ""
        parsed = urlsplit(value)
        local = parsed.scheme == "http" and parsed.hostname in ("127.0.0.1", "localhost")
        if (not (parsed.scheme == "https" or local) or not parsed.hostname
                or parsed.username or parsed.password or parsed.path not in ("", "/")
                or parsed.query or parsed.fragment
                or not re.fullmatch(r"[A-Za-z0-9.-]+", parsed.hostname)
                or any(c in value for c in " ;'\"<>\r\n\t")):
            raise ValueError("AI_API_URL must be an HTTPS origin or HTTP loopback origin")
        return value.rstrip("/")

    @field_validator("supabase_url")
    @classmethod
    def supabase_origin(cls, value: str) -> str:
        from urllib.parse import urlsplit

        if not value:
            return value
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path not in ("", "/")
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("SUPABASE_URL must be an HTTPS origin")
        return value.rstrip("/")

    @field_validator("supabase_publishable_key")
    @classmethod
    def public_key_only(cls, value: str) -> str:
        # New publishable keys only. Never accept a privileged credential by accident.
        if value and not value.startswith("sb_publishable_"):
            raise ValueError("Use a Supabase publishable key (sb_publishable_), never a secret key")
        return value

    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("database_url")
    @classmethod
    def postgres_only(cls, value: str) -> str:
        if value and make_url(value).drivername != "postgresql+psycopg":
            raise ValueError("DATABASE_URL must use postgresql+psycopg")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
