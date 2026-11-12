"""Daily "bills due today" reminders."""
import calendar
import logging
from datetime import date, datetime

from db import Store

log = logging.getLogger(__name__)


def effective_due_day(due_day: int, year: int, month: int) -> int:
    """A bill due on the 31st is due on the last day of shorter months."""
    return min(due_day, calendar.monthrange(year, month)[1])


def period_of(day: date) -> str:
    return day.strftime("%Y-%m")


def bills_due_on(store: Store, user_id: str, day: date) -> list:
    """Unpaid bills whose due date is `day`."""
    paid = store.paid_bill_ids(user_id, period_of(day))
    return [
        b
        for b in store.list_bills(user_id)
        if effective_due_day(b["due_day"], day.year, day.month) == day.day
        and b["id"] not in paid
    ]


def format_due_message(day: date, bills: list) -> str:
    if not bills:
        return f"📅 {day.month}/{day.day} 今天沒有要付的帳單 🎉"
    lines = [f"📅 {day.month}/{day.day} 今天該付的帳單："]
    total = 0
    for b in bills:
        lines.append(f"• #{b['id']} {b['name']}  NT${b['amount']:,}")
        total += b["amount"]
    lines.append(f"合計 NT${total:,}")
    lines.append("付完請回「已付 編號」，我會幫你記帳並不再提醒 ✅")
    return "\n".join(lines)


def run_daily_reminders(store: Store, line, now: datetime, send_empty: bool = False) -> dict:
    """Push today's due bills to every user. Idempotent per (date, user):
    calling it again the same day will not re-send, but a failed push is
    released so the next call retries it."""
    today = now.date()
    result = {"date": today.isoformat(), "sent": 0, "skipped": 0, "failed": 0}
    for user_id in store.list_users():
        due = bills_due_on(store, user_id, today)
        if not due and not send_empty:
            result["skipped"] += 1
            continue
        if not store.claim_reminder(today, user_id):
            result["skipped"] += 1
            continue
        try:
            line.push(user_id, format_due_message(today, due))
            result["sent"] += 1
        except Exception:
            log.exception("push failed for user %s", user_id)
            store.release_reminder(today, user_id)
            result["failed"] += 1
    return result
