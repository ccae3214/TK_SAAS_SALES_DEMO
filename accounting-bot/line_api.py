"""Minimal LINE Messaging API client (no SDK dependency)."""
import base64
import hashlib
import hmac
import logging

import requests

log = logging.getLogger(__name__)

API_BASE = "https://api.line.me/v2/bot"
MAX_TEXT = 5000  # LINE text message limit


def verify_signature(channel_secret: str, body: bytes, signature: str | None) -> bool:
    if not channel_secret or not signature:
        return False
    digest = hmac.new(channel_secret.encode(), body, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode()
    return hmac.compare_digest(expected, signature)


class LineClient:
    def __init__(self, access_token: str, session: requests.Session | None = None):
        self._session = session or requests.Session()
        self._headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    def _post(self, path: str, payload: dict) -> None:
        resp = self._session.post(
            f"{API_BASE}/{path}", json=payload, headers=self._headers, timeout=10
        )
        if resp.status_code >= 400:
            log.error("LINE API %s failed: %s %s", path, resp.status_code, resp.text)
            resp.raise_for_status()

    def reply(self, reply_token: str, text: str) -> None:
        self._post(
            "message/reply",
            {"replyToken": reply_token, "messages": [{"type": "text", "text": text[:MAX_TEXT]}]},
        )

    def push(self, user_id: str, text: str) -> None:
        self._post(
            "message/push",
            {"to": user_id, "messages": [{"type": "text", "text": text[:MAX_TEXT]}]},
        )
