"""Local operator diagnostic using the private signing key; never used by browsers."""

import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen

from backend.app.services.ai_tokens import issue
from ai_inference.app.config import Settings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--url", default="http://127.0.0.1:8018")
    parser.add_argument("--origin", required=True)
    parser.add_argument("--expected-gloss", default="")
    args = parser.parse_args()
    settings = Settings()
    Settings(ai_allowed_origins=[args.url.rstrip("/")], _env_file=None)
    token = issue(
        settings.ai_token_secret.get_secret_value(),
        "local-operator-diagnostic",
        args.origin,
        args.expected_gloss,
    )
    data = args.video.read_bytes()
    if not 0 < len(data) <= 20 * 1024 * 1024:
        raise ValueError("Video must be 1..20 MB")
    request = Request(
        args.url.rstrip("/") + "/infer",
        data=data,
        method="POST",
        headers={
            "Authorization": "Bearer " + token,
            "Origin": args.origin,
            "Content-Type": "video/webm"
            if args.video.suffix.lower() == ".webm"
            else "video/mp4",
        },
    )
    with urlopen(request, timeout=60) as response:
        print(json.dumps(json.load(response), ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
