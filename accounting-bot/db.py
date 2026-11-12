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
