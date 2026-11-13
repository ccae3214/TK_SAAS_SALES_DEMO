"""Chat command handling: turns an incoming text into a reply text."""
import re
import unicodedata
from collections import defaultdict
from datetime import date

from db import SHARED_LEDGER, Store
from images import format_pending
from reminders import bills_due_on, format_due_message, period_of
from vision import clean_note

MAX_AMOUNT = 10_000_000

HELP_TEXT = """📒 記帳小助手用法

【記帳】
• 午餐 120　（或：記 午餐 120）
• 今天　→ 今天的花費
• 本月　→ 本月統計
• 刪除記帳 12

【固定帳單】
• 新增帳單 房租 15000 5　（每月 5 號）
• 帳單　→ 列出所有帳單
• 今日帳單　→ 今天該付的
• 已付 3　→ 標記本月已付並自動記帳
• 刪除帳單 3

【圖片記帳】
• 直接傳發票、轉帳截圖或帳單的照片給我
• 我會讀出金額和日期，你回「確認」才會記帳
• 讀錯了：「改金額 360」「改名稱 午餐」；不要了：「取消」

【大家一起用】
把我拉進家人群組，群組和 1 對 1 聊天會共用同一本帳。

每天早上 8:00 我會提醒今天該付的帳單。"""

_RE_ADD_BILL = re.compile(r"^新增帳單\s+(.+?)\s+(\d+)\s+(?:每月)?(\d{1,2})\s*(?:日|號|号)?$")
_RE_DEL_BILL = re.compile(r"^刪除帳單\s*(\d+)$")
_RE_PAID = re.compile(r"^已付\s*(\d+)$")
_RE_DEL_EXPENSE = re.compile(r"^刪除記帳\s*(\d+)$")
_RE_EXPENSE = re.compile(r"^(?:記帳|記)?\s*(.*?\D)\s*(\d+)\s*元?$")
# Replies to a recognised image (see images.py). Must be matched before _RE_EXPENSE,
# which would otherwise read 「改金額 360」 as an expense called 改金額.
_RE_PENDING = re.compile(r"^(確認|取消|加入帳單)\s*(\d+)?$")
_RE_EDIT_AMOUNT = re.compile(r"^改金額\s*(\d+)$")
_RE_EDIT_NOTE = re.compile(r"^改名稱\s*(.+)$")


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).strip()
    return re.sub(r"(?<=\d),(?=\d{3})", "", text)  # 1,200 -> 1200


def _money(n: int) -> str:
    return f"NT${n:,}"


class Bot:
    def __init__(self, store: Store):
        self.store = store

    def handle(self, chat_id: str, text: str, today: date, is_group: bool = False) -> str | None:
        """Everyone shares one ledger, so `chat_id` (a user, group or room) does
        not change which data is used. In groups, text we do not understand
        gets no reply (None) so ordinary chatter is not answered."""
        user_id = SHARED_LEDGER
        text = _normalize(text)

        if text in {"說明", "help", "?", "指令", "幫助"}:
            return HELP_TEXT
        if text in {"今日帳單", "今天帳單", "今天要付", "今日待付"}:
            return format_due_message(today, bills_due_on(self.store, user_id, today))
        if text in {"帳單", "帳單列表", "所有帳單"}:
            return self._list_bills(user_id, today)
        if text in {"今天", "今日"}:
            return self._today(user_id, today)
        if text in {"本月", "月報", "本月統計"}:
            return self._month(user_id, today)

        if m := _RE_PENDING.match(text):
            return self._pending_action(chat_id, m.group(1), m.group(2), is_group)
        if m := _RE_EDIT_AMOUNT.match(text):
            return self._pending_edit(chat_id, is_group, amount=int(m.group(1)))
        if m := _RE_EDIT_NOTE.match(text):
            return self._pending_edit(chat_id, is_group, note=m.group(1))

        if m := _RE_ADD_BILL.match(text):
            return self._add_bill(user_id, m.group(1), int(m.group(2)), int(m.group(3)))
        if m := _RE_DEL_BILL.match(text):
            ok = self.store.delete_bill(user_id, int(m.group(1)))
            return "🗑️ 已刪除帳單" if ok else "找不到這筆帳單，輸入「帳單」查看編號。"
        if m := _RE_PAID.match(text):
            return self._pay_bill(user_id, int(m.group(1)), today)
        if m := _RE_DEL_EXPENSE.match(text):
            ok = self.store.delete_expense(user_id, int(m.group(1)))
            return "🗑️ 已刪除這筆記帳" if ok else "找不到這筆記帳。"
        if m := _RE_EXPENSE.match(text):
            return self._add_expense(user_id, m.group(1).strip(), int(m.group(2)), today)

        if is_group:
            return None
        return "看不懂這個指令 😅\n記帳請輸入像「午餐 120」，輸入「說明」查看所有用法。"

    # ---- image entries waiting for confirmation ------------------------------
    def _no_pending(self, pid: int | None, is_group: bool) -> str | None:
        if is_group:
            return None  # stay quiet: 「取消」/「確認」 are also ordinary words in a chat
        if pid is None:
            return "目前沒有待確認的圖片記帳。傳發票、轉帳截圖或帳單的照片給我試試。"
        return "找不到這筆待確認的圖片記帳（可能已處理過，或超過 24 小時了）。"

    def _pending_action(self, chat_id: str, action: str, pid_text: str | None, is_group: bool) -> str | None:
        pid = int(pid_text) if pid_text else None
        row = self.store.get_pending(chat_id, pid)
        if row is None:
            return self._no_pending(pid, is_group)

        if action == "取消":
            if not self.store.set_pending_status(row["id"], "cancelled"):
                return self._no_pending(pid, is_group)
            return "🗑️ 已取消這張圖片的記帳"

        if action == "加入帳單":
            if row["kind"] != "bill" or not row["due_day"]:
                return "這張看不出繳費期限，沒辦法存成固定帳單。要記帳請回「確認」。"
            row = self.store.record_pending(chat_id, row["id"], as_bill=True)
            if row is None:
                return self._no_pending(pid, is_group)
            bill_id = row["entry_id"]
            return (
                f"📌 已新增帳單 #{bill_id}\n{row['note']}  {_money(row['amount'])}\n"
                f"每月 {row['due_day']} 號\n付完回「已付 {bill_id}」就會記帳並停止提醒。"
            )

        # 確認
        spent_on = date.fromisoformat(row["spent_on"])
        duplicate = self.store.find_duplicate_expense(SHARED_LEDGER, row["amount"], spent_on)
        row = self.store.record_pending(chat_id, row["id"])
        if row is None:
            return self._no_pending(pid, is_group)
        spent_on = date.fromisoformat(row["spent_on"])
        expense_id = row["entry_id"]
        # An edit may have won the write lock after our initial preview read.
        if duplicate is not None and (duplicate["amount"] != row["amount"] or duplicate["spent_on"] != row["spent_on"]):
            duplicate = None
        lines = [
            f"✅ 已記帳 #{expense_id}",
            f"{row['note']}  {_money(row['amount'])}",
            f"📅 {spent_on.month}/{spent_on.day}",
        ]
        if duplicate is not None:
            lines.append(
                f"⚠️ 和 #{duplicate['id']}「{duplicate['note']}」金額、日期相同；"
                f"如果重複了請回「刪除記帳 {expense_id}」"
            )
        return "\n".join(lines)

    def _pending_edit(
        self, chat_id: str, is_group: bool, amount: int | None = None, note: str | None = None
    ) -> str | None:
        row = self.store.get_pending(chat_id)
        if row is None:
            return self._no_pending(None, is_group)
        if amount is not None and not 0 < amount <= MAX_AMOUNT:
            return "金額需要是 1 ～ 10,000,000 之間的整數。"
        if note is not None:
            note = clean_note(note, row["kind"])
        self.store.update_pending(row["id"], amount=amount, note=note)
        fresh = self.store.get_pending(chat_id, row["id"])
        duplicate = self.store.find_duplicate_expense(
            SHARED_LEDGER, fresh["amount"], date.fromisoformat(fresh["spent_on"])
        )
        return "✏️ 已修改\n" + format_pending(fresh, duplicate=duplicate)

    # ---- expenses --------------------------------------------------------
    def _add_expense(self, user_id: str, note: str, amount: int, today: date) -> str:
        if amount <= 0 or amount > MAX_AMOUNT:
            return "金額需要是 1 ～ 10,000,000 之間的整數。"
        if not note:
            return "請告訴我這筆是什麼，例如「午餐 120」。"
        expense_id = self.store.add_expense(user_id, amount, note, today)
        day_total = sum(e["amount"] for e in self.store.expenses_between(user_id, today, today))
        return (
            f"✅ 已記帳 #{expense_id}\n{note}  {_money(amount)}\n"
            f"今日累計 {_money(day_total)}"
        )

    def _today(self, user_id: str, today: date) -> str:
        rows = self.store.expenses_between(user_id, today, today)
        if not rows:
            return f"{today.month}/{today.day} 還沒有記帳。"
        lines = [f"🧾 {today.month}/{today.day} 花費："]
        lines += [f"• #{r['id']} {r['note']}  {_money(r['amount'])}" for r in rows]
        lines.append(f"合計 {_money(sum(r['amount'] for r in rows))}")
        return "\n".join(lines)

    def _month(self, user_id: str, today: date) -> str:
        start = today.replace(day=1)
        rows = self.store.expenses_between(user_id, start, today)
        if not rows:
            return f"{today.month} 月還沒有記帳。"
        by_note: dict[str, int] = defaultdict(int)
        for r in rows:
            by_note[r["note"]] += r["amount"]
        total = sum(by_note.values())
        lines = [f"📊 {today.month} 月統計（共 {len(rows)} 筆）", f"總支出 {_money(total)}", ""]
        top = sorted(by_note.items(), key=lambda kv: kv[1], reverse=True)[:5]
        lines += [f"• {name}  {_money(amt)}" for name, amt in top]
        if len(by_note) > len(top):
            lines.append(f"…還有 {len(by_note) - len(top)} 個項目")
        return "\n".join(lines)

    # ---- bills -----------------------------------------------------------
    def _add_bill(self, user_id: str, name: str, amount: int, due_day: int) -> str:
        if not 1 <= due_day <= 31:
            return "每月幾號需要是 1 ～ 31。"
        if amount <= 0 or amount > MAX_AMOUNT:
            return "金額需要是 1 ～ 10,000,000 之間的整數。"
        bill_id = self.store.add_bill(user_id, name, amount, due_day)
        note = "（短月份會改在月底）" if due_day > 28 else ""
        return f"📌 已新增帳單 #{bill_id}\n{name}  {_money(amount)}\n每月 {due_day} 號{note}"

    def _list_bills(self, user_id: str, today: date) -> str:
        bills = self.store.list_bills(user_id)
        if not bills:
            return "還沒有固定帳單。\n新增：新增帳單 房租 15000 5"
        paid = self.store.paid_bill_ids(user_id, period_of(today))
        lines = ["📋 固定帳單："]
        for b in bills:
            mark = "✅已付" if b["id"] in paid else ""
            lines.append(f"• #{b['id']} {b['name']}  {_money(b['amount'])}  每月{b['due_day']}號 {mark}".rstrip())
        lines.append(f"每月合計 {_money(sum(b['amount'] for b in bills))}")
        return "\n".join(lines)

    def _pay_bill(self, user_id: str, bill_id: int, today: date) -> str:
        bill = self.store.get_bill(user_id, bill_id)
        if not bill:
            return "找不到這筆帳單，輸入「帳單」查看編號。"
        period = period_of(today)
        result = self.store.pay_bill_once(user_id, bill_id, period, today)
        if result is None:
            return "找不到這筆帳單，輸入「帳單」查看編號。"
        bill = result["bill"]
        if result["already_paid"]:
            return f"{bill['name']} 本月已經標記為已付了。"
        expense_id = result["expense_id"]
        return (
            f"✅ 已付 {bill['name']}  {_money(bill['amount'])}\n"
            f"已自動記帳 #{expense_id}，本月不會再提醒。"
        )
