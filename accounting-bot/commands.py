"""Chat command handling: turns an incoming text into a reply text."""
import re
import unicodedata
from collections import defaultdict
from datetime import date

from db import Store
from reminders import bills_due_on, format_due_message, period_of

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

每天早上 8:00 我會提醒你今天該付的帳單。"""

_RE_ADD_BILL = re.compile(r"^新增帳單\s+(.+?)\s+(\d+)\s+(?:每月)?(\d{1,2})\s*(?:日|號|号)?$")
_RE_DEL_BILL = re.compile(r"^刪除帳單\s*(\d+)$")
_RE_PAID = re.compile(r"^已付\s*(\d+)$")
_RE_DEL_EXPENSE = re.compile(r"^刪除記帳\s*(\d+)$")
_RE_EXPENSE = re.compile(r"^(?:記帳|記)?\s*(.*?\D)\s*(\d+)\s*元?$")


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).strip()
    return re.sub(r"(?<=\d),(?=\d{3})", "", text)  # 1,200 -> 1200


def _money(n: int) -> str:
    return f"NT${n:,}"


class Bot:
    def __init__(self, store: Store):
        self.store = store

    def handle(self, user_id: str, text: str, today: date) -> str:
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

        return "看不懂這個指令 😅\n記帳請輸入像「午餐 120」，輸入「說明」查看所有用法。"

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
        if bill_id in self.store.paid_bill_ids(user_id, period):
            return f"{bill['name']} 本月已經標記為已付了。"
        expense_id = self.store.add_expense(user_id, bill["amount"], bill["name"], today)
        self.store.mark_paid(bill_id, period, expense_id)
        return (
            f"✅ 已付 {bill['name']}  {_money(bill['amount'])}\n"
            f"已自動記帳 #{expense_id}，本月不會再提醒。"
        )
