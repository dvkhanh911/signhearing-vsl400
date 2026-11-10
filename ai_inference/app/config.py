from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

WINDOWS_MODEL = "C:/Users/Admin/Desktop/demo/Vietnamese-Sign-Language/Siformer"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parents[1] / ".env", extra="ignore"
    )
    siformer_model_root: Path = Path(WINDOWS_MODEL)
    ai_token_secret: SecretStr = SecretStr("")
    ai_allowed_origins: list[str] = []
    ai_request_timeout: int = Field(default=45, ge=1, le=120)
    ai_upload_timeout: int = Field(default=15, ge=1, le=30)
    # CPU is explicitly authorized for the Windows classroom demo.
    ai_device: Literal["cpu"] = "cpu"
    mp_python: str = ""

    @field_validator("siformer_model_root")
    @classmethod
    def authorized_model_only(cls, value):
        expected = Path(WINDOWS_MODEL)
        if value.resolve() != expected.resolve():
            raise ValueError("Only the authorized SiFormer directory is allowed")
        return value

    @field_validator("ai_allowed_origins")
    @classmethod
    def exact_origins(cls, values):
        from urllib.parse import urlsplit

        for value in values:
            p = urlsplit(value)
            local = p.scheme == "http" and p.hostname in ("localhost", "127.0.0.1")
            if (
                not (p.scheme == "https" or local)
                or not p.hostname
                or p.path
                or p.username
                or p.password
                or p.query
                or p.fragment
                or "*" in value
            ):
                raise ValueError(
                    "Use exact HTTPS origins (HTTP allowed only on loopback)"
                )
        return values
