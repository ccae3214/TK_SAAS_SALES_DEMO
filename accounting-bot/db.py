"""SQLite storage. A fresh connection is opened per operation, so it is
safe to use from Flask request threads and the scheduler thread alike."""
import os
import sqlite3
from contextlib import contextmanager
from datetime import date

# Everyone (every 1:1 chat and every group) reads and writes this one ledger.
SHARED_LEDGER = "shared"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    user_id    TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT    NOT NULL,
    amount     INTEGER NOT NULL,
    note       TEXT    NOT NULL,
    spent_on   TEXT    NOT NULL,           -- YYYY-MM-DD
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, spent_on);

CREATE TABLE IF NOT EXISTS bills (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT    NOT NULL,
    name       TEXT    NOT NULL,
    amount     INTEGER NOT NULL,
    due_day    INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);

CREATE TABLE IF NOT EXISTS bill_payments (
    bill_id    INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    period     TEXT    NOT NULL,           -- YYYY-MM
    expense_id INTEGER REFERENCES expenses(id) ON DELETE SET NULL,
    paid_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (bill_id, period)
);

CREATE TABLE IF NOT EXISTS reminder_log (
    run_date TEXT NOT NULL,                -- YYYY-MM-DD
    user_id  TEXT NOT NULL,
    PRIMARY KEY (run_date, user_id)
);

-- Entries read from uploaded images, waiting for the user to confirm.
-- Only the extracted fields are kept; the image itself is never stored.
CREATE TABLE IF NOT EXISTS pending_receipts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id    TEXT NOT NULL,              -- the 1:1 chat / group it was sent in
    message_id TEXT NOT NULL UNIQUE,       -- LINE message id (de-duplicates redeliveries)
    status     TEXT NOT NULL DEFAULT 'processing',
                                           -- processing|pending|done|cancelled|skipped|failed
    kind       TEXT,                       -- invoice|transfer|bill
    amount     INTEGER,
    note       TEXT,
    spent_on   TEXT,                       -- YYYY-MM-DD
    due_day    INTEGER,                    -- bills: day of month the payment is due
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pending_chat ON pending_receipts(chat_id, status);
"""


class Store:
    def __init__(self, path: str):
        self.path = path
        if path != ":memory:":
            directory = os.path.dirname(os.path.abspath(path))
            os.makedirs(directory, exist_ok=True)
        self._memory_conn = None
        if path == ":memory:":
            self._memory_conn = self._open()
        with self._conn() as conn:
            conn.executescript(SCHEMA)

    def _open(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=10, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    @contextmanager
    def _conn(self):
        conn = self._memory_conn or self._open()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            if self._memory_conn is None:
                conn.close()

    # ---- users -----------------------------------------------------------
    def add_user(self, user_id: str) -> None:
        with self._conn() as c:
            c.execute("INSERT OR IGNORE INTO users(user_id) VALUES (?)", (user_id,))

    def list_users(self) -> list[str]:
        with self._conn() as c:
            return [r["user_id"] for r in c.execute("SELECT user_id FROM users")]

    def merge_into(self, ledger_id: str) -> None:
        """Move any per-user rows (from before the ledger was shared) into
        `ledger_id`. Idempotent, so it is safe to run on every start."""
        with self._conn() as c:
            c.execute("UPDATE expenses SET user_id=? WHERE user_id<>?", (ledger_id, ledger_id))
            c.execute("UPDATE bills SET user_id=? WHERE user_id<>?", (ledger_id, ledger_id))

    # ---- expenses --------------------------------------------------------
    def add_expense(self, user_id: str, amount: int, note: str, spent_on: date) -> int:
        with self._conn() as c:
            cur = c.execute(
                "INSERT INTO expenses(user_id, amount, note, spent_on) VALUES (?,?,?,?)",
                (user_id, amount, note, spent_on.isoformat()),
            )
            return cur.lastrowid

    def expenses_between(self, user_id: str, start: date, end: date) -> list[sqlite3.Row]:
        """Inclusive date range."""
        with self._conn() as c:
            return c.execute(
                "SELECT * FROM expenses WHERE user_id=? AND spent_on BETWEEN ? AND ? "
                "ORDER BY spent_on, id",
                (user_id, start.isoformat(), end.isoformat()),
            ).fetchall()

    def delete_expense(self, user_id: str, expense_id: int) -> bool:
        with self._conn() as c:
            cur = c.execute(
                "DELETE FROM expenses WHERE id=? AND user_id=?", (expense_id, user_id)
            )
            return cur.rowcount > 0

    # ---- bills -----------------------------------------------------------
    def add_bill(self, user_id: str, name: str, amount: int, due_day: int) -> int:
        with self._conn() as c:
            cur = c.execute(
                "INSERT INTO bills(user_id, name, amount, due_day) VALUES (?,?,?,?)",
                (user_id, name, amount, due_day),
            )
            return cur.lastrowid

    def list_bills(self, user_id: str) -> list[sqlite3.Row]:
        with self._conn() as c:
            return c.execute(
                "SELECT * FROM bills WHERE user_id=? ORDER BY due_day, id", (user_id,)
            ).fetchall()

    def get_bill(self, user_id: str, bill_id: int) -> sqlite3.Row | None:
        with self._conn() as c:
            return c.execute(
                "SELECT * FROM bills WHERE id=? AND user_id=?", (bill_id, user_id)
            ).fetchone()

    def delete_bill(self, user_id: str, bill_id: int) -> bool:
        with self._conn() as c:
            cur = c.execute(
                "DELETE FROM bills WHERE id=? AND user_id=?", (bill_id, user_id)
            )
            return cur.rowcount > 0

    # ---- bill payments ---------------------------------------------------
    def mark_paid(self, bill_id: int, period: str, expense_id: int | None) -> bool:
        """Returns False if this bill was already marked paid for the period."""
        with self._conn() as c:
            cur = c.execute(
                "INSERT OR IGNORE INTO bill_payments(bill_id, period, expense_id) "
                "VALUES (?,?,?)",
                (bill_id, period, expense_id),
            )
            return cur.rowcount > 0

    def paid_bill_ids(self, user_id: str, period: str) -> set[int]:
        with self._conn() as c:
            rows = c.execute(
                "SELECT p.bill_id FROM bill_payments p JOIN bills b ON b.id=p.bill_id "
                "WHERE b.user_id=? AND p.period=?",
                (user_id, period),
            )
            return {r["bill_id"] for r in rows}

    # ---- reminder idempotency -------------------------------------------
    def claim_reminder(self, run_date: date, user_id: str) -> bool:
        """True if this (date, user) had not been claimed yet."""
        with self._conn() as c:
            cur = c.execute(
                "INSERT OR IGNORE INTO reminder_log(run_date, user_id) VALUES (?,?)",
                (run_date.isoformat(), user_id),
            )
            return cur.rowcount > 0

    def release_reminder(self, run_date: date, user_id: str) -> None:
        with self._conn() as c:
            c.execute(
                "DELETE FROM reminder_log WHERE run_date=? AND user_id=?",
                (run_date.isoformat(), user_id),
            )

    # ---- image receipts (pending confirmation) --------------------------
    def claim_image(self, chat_id: str, message_id: str) -> int | None:
        """Reserve an uploaded image. None if this LINE message was already seen."""
        with self._conn() as c:
            cur = c.execute(
                "INSERT OR IGNORE INTO pending_receipts(chat_id, message_id) VALUES (?,?)",
                (chat_id, message_id),
            )
            return cur.lastrowid if cur.rowcount > 0 else None

    def count_images_since(self, chat_id: str, hours: int = 24) -> int:
        with self._conn() as c:
            return c.execute(
                "SELECT COUNT(*) FROM pending_receipts WHERE chat_id=? "
                "AND created_at >= datetime('now', ?)",
                (chat_id, f"-{int(hours)} hours"),
            ).fetchone()[0]

    def fill_pending(
        self, pid: int, kind: str, amount: int, note: str, spent_on: date, due_day: int | None
    ) -> None:
        with self._conn() as c:
            c.execute(
                "UPDATE pending_receipts SET kind=?, amount=?, note=?, spent_on=?, due_day=?, "
                "status='pending' WHERE id=?",
                (kind, amount, note, spent_on.isoformat(), due_day, pid),
            )

    def get_pending(self, chat_id: str, pid: int | None = None) -> sqlite3.Row | None:
        """The given (or, without `pid`, the latest) entry of this chat that is still
        waiting for confirmation and younger than 24 hours."""
        sql = (
            "SELECT * FROM pending_receipts WHERE chat_id=? AND status='pending' "
            "AND created_at >= datetime('now', '-1 day')"
        )
        args: list = [chat_id]
        if pid is not None:
            sql += " AND id=?"
            args.append(pid)
        with self._conn() as c:
            return c.execute(sql + " ORDER BY id DESC LIMIT 1", args).fetchone()

    def update_pending(self, pid: int, amount: int | None = None, note: str | None = None) -> None:
        sets, args = [], []
        if amount is not None:
            sets.append("amount=?")
            args.append(amount)
        if note is not None:
            sets.append("note=?")
            args.append(note)
        if not sets:
            return
        with self._conn() as c:
            c.execute(
                f"UPDATE pending_receipts SET {', '.join(sets)} WHERE id=? AND status='pending'",
                (*args, pid),
            )

    def set_pending_status(self, pid: int, status: str, expect: str = "pending") -> bool:
        """Atomic transition; False if the entry was not in the `expect` state
        (e.g. a double tap on 「確認」 only records once)."""
        with self._conn() as c:
            cur = c.execute(
                "UPDATE pending_receipts SET status=? WHERE id=? AND status=?",
                (status, pid, expect),
            )
            return cur.rowcount > 0

    def find_duplicate_expense(self, user_id: str, amount: int, spent_on: date) -> sqlite3.Row | None:
        with self._conn() as c:
            return c.execute(
                "SELECT * FROM expenses WHERE user_id=? AND amount=? AND spent_on=? "
                "ORDER BY id DESC LIMIT 1",
                (user_id, amount, spent_on.isoformat()),
            ).fetchone()
