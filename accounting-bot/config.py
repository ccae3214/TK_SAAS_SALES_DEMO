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


def _int(value: str | None, default: int) -> int:
    try:
        return int(value) if value not in (None, "") else default
    except ValueError:
        return default


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
    # Image recognition (receipts / transfer screenshots / bills). Off without a key.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5-5"
    image_in_groups: bool = False
    max_images_per_day: int = 30

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
            anthropic_api_key=env.get("ANTHROPIC_API_KEY", ""),
            anthropic_model=env.get("ANTHROPIC_MODEL") or "claude-sonnet-5-5",
            image_in_groups=_bool(env.get("IMAGE_IN_GROUPS"), False),
            max_images_per_day=_int(env.get("MAX_IMAGES_PER_DAY"), 30),
        )
