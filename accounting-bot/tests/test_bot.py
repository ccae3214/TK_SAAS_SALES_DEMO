import base64
import hashlib
import hmac
import json
import os
import sys
from datetime import date, datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from app import create_app
from commands import Bot
from config import Config
from db import Store
from reminders import bills_due_on, effective_due_day, run_daily_reminders

TZ = ZoneInfo("Asia/Taipei")
U = "Uabc"


class FakeLine:
    def __init__(self):
        self.replies, self.pushes, self.fail = [], [], False

    def reply(self, token, text):
        self.replies.append((token, text))

    def push(self, user_id, text):
        if self.fail:
            raise RuntimeError("boom")
        self.pushes.append((user_id, text))


@pytest.fixture
def store():
    return Store(":memory:")


@pytest.fixture
def bot(store):
    return Bot(store)


# ---- expenses -------------------------------------------------------------
def test_expense_formats(bot):
    d = date(2026, 11, 12)
    for text in ["午餐 120", "午餐120", "記 午餐 120", "記帳 午餐 120元", "午餐　１２０"]:
        assert "已記帳" in bot.handle(U, text, d)
    r = bot.handle(U, "7-11 咖啡 50", d)
    assert "7-11 咖啡" in r and "NT$50" in r


def test_expense_total_and_month(bot):
    d = date(2026, 11, 12)
    bot.handle(U, "午餐 100", d)
    r = bot.handle(U, "午餐 1,200", d)
    assert "今日累計 NT$1,300" in r
    month = bot.handle(U, "本月", d)
    assert "NT$1,300" in month and "午餐" in month
    assert "NT$1,300" in bot.handle(U, "今天", d)


def test_invalid_amount_and_unknown(bot):
    d = date(2026, 11, 12)
    assert "金額" in bot.handle(U, "午餐 0", d)
    assert "看不懂" in bot.handle(U, "你好", d)


def test_delete_expense_is_scoped_to_user(bot):
    d = date(2026, 11, 12)
    bot.handle(U, "午餐 100", d)
    assert "找不到" in bot.handle("Uother", "刪除記帳 1", d)
    assert "已刪除" in bot.handle(U, "刪除記帳 1", d)


# ---- bills ----------------------------------------------------------------
def test_bill_lifecycle(bot):
    d = date(2026, 11, 12)
    assert "已新增帳單 #1" in bot.handle(U, "新增帳單 房租 15000 12", d)
    assert "每月12號" in bot.handle(U, "帳單", d)
    assert "房租" in bot.handle(U, "今日帳單", d)

    assert "已付 房租" in bot.handle(U, "已付 1", d)
    assert "已經標記" in bot.handle(U, "已付 1", d)
    assert "沒有要付" in bot.handle(U, "今日帳單", d)
    assert "NT$15,000" in bot.handle(U, "今天", d)  # auto-recorded expense
    assert "✅已付" in bot.handle(U, "帳單", d)

    # next month it is due (and unpaid) again
    assert "房租" in bot.handle(U, "今日帳單", date(2026, 12, 12))
    assert "已刪除" in bot.handle(U, "刪除帳單 1", d)


def test_month_end_clamp(store):
    assert effective_due_day(31, 2026, 2) == 28
    assert effective_due_day(31, 2026, 4) == 30
    assert effective_due_day(31, 2024, 2) == 29
    store.add_bill(U, "信用卡", 3000, 31)
    assert len(bills_due_on(store, U, date(2026, 2, 28))) == 1
    assert len(bills_due_on(store, U, date(2026, 2, 27))) == 0
    assert len(bills_due_on(store, U, date(2026, 1, 31))) == 1


# ---- reminders ------------------------------------------------------------
def test_reminder_sent_once_per_day(store):
    store.add_user(U)
    store.add_user("Unobills")
    store.add_bill(U, "網路費", 599, 12)
    line = FakeLine()
    now = datetime(2026, 11, 12, 8, 0, tzinfo=TZ)

    r1 = run_daily_reminders(store, line, now)
    r2 = run_daily_reminders(store, line, now)
    assert r1["sent"] == 1 and r2["sent"] == 0
    assert len(line.pushes) == 1
    assert line.pushes[0][0] == U and "網路費" in line.pushes[0][1]


def test_reminder_skips_paid_and_retries_failures(store):
    store.add_user(U)
    bid = store.add_bill(U, "電費", 800, 12)
    line = FakeLine()
    now = datetime(2026, 11, 12, 8, 0, tzinfo=TZ)

    line.fail = True
    assert run_daily_reminders(store, line, now)["failed"] == 1
    line.fail = False
    assert run_daily_reminders(store, line, now)["sent"] == 1  # retried

    store.mark_paid(bid, "2026-12", None)
    assert run_daily_reminders(store, line, datetime(2026, 12, 12, 8, 0, tzinfo=TZ))["sent"] == 0


# ---- webhook --------------------------------------------------------------
SECRET = "s3cret"


def _sign(body: bytes) -> str:
    return base64.b64encode(hmac.new(SECRET.encode(), body, hashlib.sha256).digest()).decode()


@pytest.fixture
def client(store):
    line = FakeLine()
    cfg = Config(channel_secret=SECRET, cron_token="tok")
    app = create_app(cfg, store=store, line=line)
    c = app.test_client()
    c.line, c.store = line, store
    return c


def _event(text, user=U, source_type="user"):
    return {
        "events": [
            {
                "type": "message",
                "replyToken": "rt",
                "source": {"type": source_type, "userId": user},
                "message": {"type": "text", "text": text},
            }
        ]
    }


def test_webhook_rejects_bad_signature(client):
    body = json.dumps(_event("午餐 100")).encode()
    assert client.post("/callback", data=body, headers={"X-Line-Signature": "nope"}).status_code == 400
    assert client.post("/callback", data=body).status_code == 400


def test_webhook_records_expense_and_replies(client):
    body = json.dumps(_event("午餐 100")).encode()
    r = client.post("/callback", data=body, headers={"X-Line-Signature": _sign(body)})
    assert r.status_code == 200
    assert "已記帳" in client.line.replies[0][1]
    assert U in client.store.list_users()


def test_webhook_ignores_group_chats(client):
    body = json.dumps(_event("午餐 100", source_type="group")).encode()
    client.post("/callback", data=body, headers={"X-Line-Signature": _sign(body)})
    assert client.line.replies == []


def test_cron_endpoint_auth_and_run(client):
    client.store.add_user(U)
    assert client.get("/cron/daily-reminder").status_code == 403
    assert client.get("/cron/daily-reminder?token=wrong").status_code == 403
    ok = client.get("/cron/daily-reminder", headers={"X-Cron-Token": "tok"})
    assert ok.status_code == 200 and ok.get_json()["sent"] == 0


def test_cron_disabled_without_token(store):
    app = create_app(Config(channel_secret=SECRET), store=store, line=FakeLine())
    assert app.test_client().get("/cron/daily-reminder").status_code == 404
