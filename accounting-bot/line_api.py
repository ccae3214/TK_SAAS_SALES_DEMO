"""Minimal LINE Messaging API client (no SDK dependency)."""
import base64
import hashlib
import hmac
import logging
import re

import requests

log = logging.getLogger(__name__)

API_BASE = "https://api.line.me/v2/bot"
DATA_BASE = "https://api-data.line.me/v2/bot"
MAX_TEXT = 5000  # LINE text message limit
MAX_QUICK_REPLIES = 13
DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024


class ImageTooLarge(Exception):
    """The uploaded image is bigger than we are willing to download/process."""


def verify_signature(channel_secret: str, body: bytes, signature: str | None) -> bool:
    if not channel_secret or not signature:
        return False
    digest = hmac.new(channel_secret.encode(), body, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode()
    return hmac.compare_digest(expected, signature)


def _text_message(text: str, quick_replies: list[tuple[str, str]] | None = None) -> dict:
    """quick_replies: [(button label, text sent to the chat when tapped), ...]"""
    message = {"type": "text", "text": text[:MAX_TEXT]}
    if quick_replies:
        message["quickReply"] = {
            "items": [
                {"type": "action", "action": {"type": "message", "label": label[:20], "text": sent}}
                for label, sent in quick_replies[:MAX_QUICK_REPLIES]
            ]
        }
    return message


class LineClient:
    def __init__(self, access_token: str, session: requests.Session | None = None):
        self._session = session or requests.Session()
        self._auth = {"Authorization": f"Bearer {access_token}"}
        self._headers = {**self._auth, "Content-Type": "application/json"}

    def _post(self, path: str, payload: dict) -> None:
        resp = self._session.post(
            f"{API_BASE}/{path}", json=payload, headers=self._headers, timeout=10
        )
        if resp.status_code >= 400:
            log.error("LINE API %s failed: %s %s", path, resp.status_code, resp.text)
            resp.raise_for_status()

    def reply(self, reply_token: str, text: str, quick_replies=None) -> None:
        self._post(
            "message/reply",
            {"replyToken": reply_token, "messages": [_text_message(text, quick_replies)]},
        )

    def push(self, user_id: str, text: str, quick_replies=None) -> None:
        self._post(
            "message/push",
            {"to": user_id, "messages": [_text_message(text, quick_replies)]},
        )

    def show_loading(self, chat_id: str, seconds: int = 20) -> None:
        """Show the typing/loading animation (1:1 chats only; best effort, not a message)."""
        self._post("chat/loading/start", {"chatId": chat_id, "loadingSeconds": seconds})

    def get_content(self, message_id: str, max_bytes: int = DEFAULT_MAX_IMAGE_BYTES) -> bytes:
        """Download an image the user sent. Raises ImageTooLarge past `max_bytes`."""
        if not re.fullmatch(r"\d+", message_id or ""):
            raise ValueError("invalid message id")
        resp = self._session.get(
            f"{DATA_BASE}/message/{message_id}/content",
            headers=self._auth,
            timeout=20,
            stream=True,
        )
        try:
            resp.raise_for_status()
            declared = resp.headers.get("Content-Length", "")
            if declared.isdigit() and int(declared) > max_bytes:
                raise ImageTooLarge(declared)
            chunks, total = [], 0
            for chunk in resp.iter_content(65536):
                total += len(chunk)
                if total > max_bytes:
                    raise ImageTooLarge(str(total))
                chunks.append(chunk)
            return b"".join(chunks)
        finally:
            resp.close()
