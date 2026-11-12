"""Runtime configuration, read from environment variables."""
import os
from dataclasses import dataclass
from datetime import time


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_hhmm(value: str) -> time:
    hour, minute = value.strip().split(":")
    return time(int(hour), int(minute))


@dataclass(frozen=True)
class Config:
    channel_secret: str = ""
    channel_access_token: str = ""
    database_path: str = "data/bot.sqlite3"
    timezone: str = "Asia/Taipei"
    reminder_time: time = time(8, 0)
    enable_scheduler: bool = False
    send_empty_reminder: bool = False
    cron_token: str = ""

    @classmethod
    def from_env(cls) -> "Config":
        env = os.environ
        return cls(
            channel_secret=env.get("LINE_CHANNEL_SECRET", ""),
            channel_access_token=env.get("LINE_CHANNEL_ACCESS_TOKEN", ""),
            database_path=env.get("DATABASE_PATH", "data/bot.sqlite3"),
            timezone=env.get("TIMEZONE", "Asia/Taipei"),
            reminder_time=_parse_hhmm(env.get("REMINDER_TIME", "08:00")),
            enable_scheduler=_bool(env.get("ENABLE_SCHEDULER"), False),
            send_empty_reminder=_bool(env.get("SEND_EMPTY_REMINDER"), False),
            cron_token=env.get("CRON_TOKEN", ""),
        )
