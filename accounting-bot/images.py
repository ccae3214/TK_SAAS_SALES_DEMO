"""Turns an uploaded image into a *pending* ledger entry the user confirms.

Nothing is written to the ledger from a picture until the user replies
「確認」: OCR can misread an amount, and a wrong number in a ledger is worse than
one extra tap. Images are never stored; only the extracted fields are kept, and
only until the entry is confirmed, cancelled or 24 hours old.
"""
import logging
from datetime import date

from db import SHARED_LEDGER, Store
from line_api import ImageTooLarge
from vision import MAX_IMAGE_BYTES, sniff_media_type

log = logging.getLogger(__name__)

KIND_LABEL = {"invoice": "發票／收據", "transfer": "轉帳", "bill": "帳單"}

MSG_DISABLED = (
    "📷 圖片辨識還沒有啟用（管理者需要設定 ANTHROPIC_API_KEY）。\n"
    "先用文字記帳吧，例如「午餐 120」。"
)
MSG_LIMIT = "📷 今天辨識的圖片已達上限（{n} 張），請明天再傳，或直接輸入「午餐 120」記帳。"
MSG_TOO_LARGE = "這張圖片太大了（上限 5MB），請縮小或改用截圖再傳一次。"
MSG_BAD_FORMAT = "我只看得懂 JPG、PNG、GIF、WebP 圖片喔。"
MSG_DOWNLOAD_FAIL = "下載圖片失敗了，請再傳一次。"
MSG_EXTRACT_FAIL = "辨識圖片時出錯了，請稍後再傳一次，或直接輸入「午餐 120」記帳。"
MSG_NOT_RECOGNISED = (
    "我看不出這張圖的金額 🤔\n"
    "請傳清楚一點的發票、轉帳截圖或帳單（拍正、光線充足），或直接輸入「午餐 120」記帳。"
)
MSG_INCOMING = "這看起來是「收到」的轉帳（NT${amount}），目前只支援支出記帳，所以沒有記錄。"
MSG_FOREIGN = (
    "這張的幣別是 {currency}（金額 {amount}），目前只支援新台幣，所以沒有記錄。\n"
    "要記的話請輸入換算後的金額，例如「機票 12000」。"
)


def _money(n: int) -> str:
    return f"NT${n:,}"


def format_pending(row, *, confidence: str | None = None, duplicate=None, date_guessed: bool = False) -> str:
    """The confirmation message for a pending entry (`row` is a pending_receipts row)."""
    spent = date.fromisoformat(row["spent_on"])
    when = f"{spent.year}/{spent.month}/{spent.day}"
    if date_guessed:
        when += "（圖上看不到日期，暫以今天計）"
    lines = [
        f"📷 辨識結果（{KIND_LABEL.get(row['kind'], row['kind'])}）",
        f"🏷️ {row['note']}",
        f"💰 {_money(row['amount'])}",
        f"📅 {when}",
    ]
    if row["kind"] == "bill" and row["due_day"]:
        lines.append(f"⏰ 繳費期限 {row['due_day']} 號")
    if confidence == "low":
        lines.append("⚠️ 辨識信心較低，請特別確認金額與日期")
    if duplicate is not None:
        lines.append(f"⚠️ 同一天已有相同金額的記帳 #{duplicate['id']}「{duplicate['note']}」，可能重複")
    lines += ["", "回「確認」記帳、「取消」捨棄", "讀錯了可以改：「改金額 360」「改名稱 午餐」"]
    if row["kind"] == "bill" and row["due_day"]:
        lines.append("每月都要付？回「加入帳單」存成固定帳單")
    return "\n".join(lines)


def quick_replies_for(pid: int, kind: str, due_day: int | None) -> list[tuple[str, str]]:
    """(label, text sent when tapped). The id makes taps unambiguous when several
    images are waiting for confirmation."""
    confirm = "✅ 已付款，記帳" if kind == "bill" else "✅ 確認記帳"
    items = [(confirm, f"確認 {pid}")]
    if kind == "bill" and due_day:
        items.append(("📌 加入固定帳單", f"加入帳單 {pid}"))
    items.append(("❌ 取消", f"取消 {pid}"))
    return items


class ImageService:
    def __init__(self, store: Store, line, extractor, allow_groups: bool = False, max_per_day: int = 30):
        self.store = store
        self.line = line
        self.extractor = extractor
        self.allow_groups = allow_groups
        self.max_per_day = max_per_day

    # ---- delivery -------------------------------------------------------------
    def _send(self, reply_token, chat_id, text, quick=None) -> None:
        """Reply (free); if the token is no longer valid fall back to a push."""
        try:
            self.line.reply(reply_token, text, quick_replies=quick)
        except Exception:
            log.warning("reply failed, falling back to push", exc_info=True)
            try:
                self.line.push(chat_id, text, quick_replies=quick)
            except Exception:
                log.exception("push fallback failed")

    # ---- main flow ------------------------------------------------------------
    def process(self, chat_id: str, message_id: str, reply_token: str, is_group: bool, today: date) -> None:
        if is_group and not self.allow_groups:
            return  # family groups are full of photos; don't pay to read them all
        pid = self.store.claim_image(chat_id, message_id)
        if pid is None:
            return  # this LINE message was already handled (redelivery)

        def say(text: str) -> None:
            if not is_group:  # in groups only a successful result is worth a message
                self._send(reply_token, chat_id, text)

        def finish(status: str) -> None:
            self.store.set_pending_status(pid, status, expect="processing")

        if self.extractor is None:
            finish("failed")
            say(MSG_DISABLED)
            return
        if self.store.count_images_since(chat_id, 24) > self.max_per_day:
            finish("skipped")
            say(MSG_LIMIT.format(n=self.max_per_day))
            return

        if not is_group:
            try:
                self.line.show_loading(chat_id)
            except Exception:
                log.debug("loading animation unavailable", exc_info=True)

        try:
            data = self.line.get_content(message_id, MAX_IMAGE_BYTES)
        except ImageTooLarge:
            finish("skipped")
            say(MSG_TOO_LARGE)
            return
        except Exception:
            log.exception("could not download image %s", message_id)
            finish("failed")
            say(MSG_DOWNLOAD_FAIL)
            return

        media_type = sniff_media_type(data)
        if media_type is None:
            finish("skipped")
            say(MSG_BAD_FORMAT)
            return

        try:
            ex = self.extractor.extract(data, media_type, today)
        except Exception:
            log.exception("image recognition failed for %s", message_id)
            finish("failed")
            say(MSG_EXTRACT_FAIL)
            return

        if ex.doc_type == "other" or ex.amount is None:
            finish("skipped")
            say(MSG_NOT_RECOGNISED)
            return
        if ex.currency != "TWD":
            finish("skipped")
            say(MSG_FOREIGN.format(currency=ex.currency, amount=f"{ex.amount:,}"))
            return
        if ex.doc_type == "transfer" and ex.direction == "incoming":
            finish("skipped")
            say(MSG_INCOMING.format(amount=f"{ex.amount:,}"))
            return

        # A bill is recorded on the day it is paid; receipts and transfers on their own date.
        use_doc_date = ex.doc_type in ("invoice", "transfer") and ex.doc_date is not None
        spent_on = ex.doc_date if use_doc_date else today
        date_guessed = ex.doc_type in ("invoice", "transfer") and ex.doc_date is None
        due_day = ex.due_date.day if ex.doc_type == "bill" and ex.due_date else None

        self.store.fill_pending(pid, ex.doc_type, ex.amount, ex.note, spent_on, due_day)
        row = self.store.get_pending(chat_id, pid)
        duplicate = self.store.find_duplicate_expense(SHARED_LEDGER, ex.amount, spent_on)
        text = format_pending(row, confidence=ex.confidence, duplicate=duplicate, date_guessed=date_guessed)
        self._send(reply_token, chat_id, text, quick_replies_for(pid, ex.doc_type, due_day))
