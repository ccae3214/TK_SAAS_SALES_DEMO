"""Flask app: LINE webhook, cron endpoint, and optional in-process scheduler."""
import hmac
import json
import logging
import threading
import time as time_mod
from datetime import datetime
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, request

from commands import Bot
from config import Config
from db import Store
from line_api import LineClient, verify_signature
from reminders import run_daily_reminders

log = logging.getLogger(__name__)

WELCOME = "嗨！我是你的記帳小助手 📒\n直接輸入「午餐 120」就能記帳，輸入「說明」查看所有功能。"


def create_app(config: Config | None = None, store: Store | None = None, line=None) -> Flask:
    config = config or Config.from_env()
    store = store or Store(config.database_path)
    line = line or LineClient(config.channel_access_token)
    bot = Bot(store)
    tz = ZoneInfo(config.timezone)

    app = Flask(__name__)
    app.config["BOT_CONFIG"] = config

    def now() -> datetime:
        return datetime.now(tz)

    @app.get("/healthz")
    def healthz():
        return jsonify(status="ok")

    @app.post("/callback")
    def callback():
        body = request.get_data()
        if not config.channel_secret:
            log.error("LINE_CHANNEL_SECRET is not configured")
            return "server not configured", 500
        if not verify_signature(config.channel_secret, body, request.headers.get("X-Line-Signature")):
            return "invalid signature", 400

        try:
            events = json.loads(body).get("events", [])
        except ValueError:
            return "bad request", 400

        for event in events:
            try:
                _handle_event(event)
            except Exception:
                # Never fail the webhook: LINE would retry and we'd double-record.
                log.exception("failed handling event")
        return "OK"

    def _handle_event(event: dict) -> None:
        source = event.get("source", {})
        user_id = source.get("userId")
        if not user_id or source.get("type") != "user":
            return  # only 1:1 chats; ignore groups/rooms
        etype = event.get("type")
        reply_token = event.get("replyToken")
        if etype == "follow":
            store.add_user(user_id)
            line.reply(reply_token, WELCOME)
        elif etype == "message" and event.get("message", {}).get("type") == "text":
            store.add_user(user_id)
            reply = bot.handle(user_id, event["message"]["text"], now().date())
            line.reply(reply_token, reply)

    @app.route("/cron/daily-reminder", methods=["GET", "POST"])
    def cron_daily_reminder():
        if not config.cron_token:
            return "disabled", 404
        supplied = request.headers.get("X-Cron-Token") or request.args.get("token", "")
        if not hmac.compare_digest(supplied, config.cron_token):
            return "forbidden", 403
        return jsonify(run_daily_reminders(store, line, now(), config.send_empty_reminder))

    if config.enable_scheduler:
        _start_scheduler(store, line, config, tz)

    return app


def _start_scheduler(store: Store, line, config: Config, tz: ZoneInfo) -> None:
    """Checks every minute; once past REMINDER_TIME it sends today's reminders.
    run_daily_reminders is idempotent per (date, user), so multiple workers or
    the cron endpoint running as well will not cause duplicate messages."""

    def loop() -> None:
        while True:
            try:
                current = datetime.now(tz)
                if current.time() >= config.reminder_time:
                    run_daily_reminders(store, line, current, config.send_empty_reminder)
            except Exception:
                log.exception("scheduler tick failed")
            time_mod.sleep(60)

    threading.Thread(target=loop, name="reminder-scheduler", daemon=True).start()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    create_app().run(host="0.0.0.0", port=8000)
