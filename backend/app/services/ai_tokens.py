"""Small versioned HMAC protocol shared by Vercel and the local inference service.

These are purpose-specific capabilities, not Supabase JWTs or login sessions.
"""

import base64
import hashlib
import hmac
import json
import secrets
import time

ISSUER = "signhearing-vercel"
AUDIENCE = "signhearing-siformer"
TTL = 120


class InvalidCapability(ValueError):
    pass


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _signature(payload: str, secret: str) -> str:
    if len(secret.encode()) < 32:
        raise InvalidCapability("AI signing key must contain at least 32 bytes")
    return _encode(hmac.digest(secret.encode(), ("v1." + payload).encode(), hashlib.sha256))


def issue(secret: str, subject: str, origin: str, expected_gloss: str) -> str:
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "scope": "infer",
        "sub": subject,
        "origin": origin,
        "expected_gloss": expected_gloss,
        "iat": now,
        "exp": now + TTL,
        "jti": secrets.token_urlsafe(18),
    }
    payload = _encode(json.dumps(claims, separators=(",", ":"), ensure_ascii=False).encode())
    return "v1." + payload + "." + _signature(payload, secret)


def verify(token: str, secret: str, origin: str, now: int | None = None) -> dict:
    try:
        if len(token) > 4096:
            raise ValueError()
        version, payload, signature = token.split(".")
        if version != "v1" or not hmac.compare_digest(signature, _signature(payload, secret)):
            raise ValueError()
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        clock = int(time.time()) if now is None else now
        if (
            claims["iss"] != ISSUER
            or claims["aud"] != AUDIENCE
            or claims["scope"] != "infer"
            or claims["origin"] != origin
            or not isinstance(claims["sub"], str)
            or not claims["sub"]
            or not isinstance(claims["jti"], str)
            or not isinstance(claims["expected_gloss"], str)
            or type(claims["exp"]) is not int
            or type(claims["iat"]) is not int
            or not 0 < claims["exp"] - claims["iat"] <= TTL
            or claims["iat"] > clock + 5
            or claims["exp"] <= clock
        ):
            raise ValueError()
        return claims
    except (ValueError, KeyError, TypeError, UnicodeError) as exc:
        raise InvalidCapability("Invalid inference capability") from exc
