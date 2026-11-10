"""Configure AI variables only; preserve all existing OAuth and Supabase settings."""

import argparse
import json
import os
import secrets
from pathlib import Path

from dotenv import dotenv_values

from ai_inference.app.config import Settings

ROOT = Path(__file__).resolve().parents[1]


def update(path, values):
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    lines = [
        line
        for line in text.splitlines()
        if line.split("=", 1)[0].strip() not in values
    ]
    lines.extend(key + "=" + value for key, value in values.items())
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", action="append", required=True)
    parser.add_argument("--api-url", default="http://127.0.0.1:8018")
    parser.add_argument("--device", choices=("cpu",), default="cpu")
    parser.add_argument("--mp-python", type=Path)
    args = parser.parse_args()
    Settings(ai_allowed_origins=args.origin, _env_file=None)  # Validate before writing.
    Settings(ai_allowed_origins=[args.api_url.rstrip("/")], _env_file=None)
    local = ROOT / "ai_inference/.env"
    old = dotenv_values(local) if local.exists() else {}
    secret = old.get("AI_TOKEN_SECRET") or secrets.token_urlsafe(48)
    default_mp = (
        Path(
            "C:/Users/Admin/Desktop/demo/Vietnamese-Sign-Language/.venv-mp/Scripts/python.exe"
        )
        if os.name == "nt"
        else ROOT / "ai_inference/.venv-mp/bin/python"
    )
    update(
        local,
        {
            "AI_DEVICE": args.device,
            "AI_TOKEN_SECRET": secret,
            "AI_ALLOWED_ORIGINS": json.dumps(args.origin),
            "MP_PYTHON": str((args.mp_python or default_mp).resolve()),
        },
    )
    update(
        ROOT / "backend/.env", {"AI_TOKEN_SECRET": secret, "AI_API_URL": args.api_url}
    )
    print("Configured AI variables in ignored local .env files. No secrets printed.")
    print(
        "Restart the backend and inference service. Configure the same secret on Vercel before deployment."
    )


if __name__ == "__main__":
    main()
