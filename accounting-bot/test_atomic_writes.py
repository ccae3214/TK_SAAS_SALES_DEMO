"""Real SQLite fault/concurrency regressions for merged PRs #19 and #21.

Every database is a pytest temporary file, never the application's ledger.
"""
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from threading import Barrier

import pytest

from commands import Bot
from db import SHARED_LEDGER, Store

TODAY = date(2026, 11, 13)
CHAT = 'review-fictional-chat'


@pytest.fixture
def store(tmp_path):
    return Store(str(tmp_path / 'atomic.sqlite3'))


def pending(store, kind='invoice'):
    pid = store.claim_image(CHAT, 'review-fictional-image')
    store.fill_pending(pid, kind, 360, 'DEMO receipt', TODAY, 15 if kind == 'bill' else None)
    return pid


def count(store, table):
    with store._conn() as c:
        return c.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]


@pytest.mark.parametrize('action,table,kind', [
    ('確認', 'expenses', 'invoice'), ('加入帳單', 'bills', 'bill'),
])
def test_failed_receipt_insert_keeps_pending_and_can_retry(store, action, table, kind):
    pid = pending(store, kind)
    with store._conn() as c:
        c.execute(f"CREATE TRIGGER reject_write BEFORE INSERT ON {table} BEGIN SELECT RAISE(ABORT, 'injected_failure'); END")
    with pytest.raises(sqlite3.IntegrityError, match='injected_failure'):
        Bot(store).handle(CHAT, f'{action} {pid}', TODAY)
    assert store.get_pending(CHAT, pid) is not None, 'failed write must not consume the pending receipt'
    assert count(store, table) == 0
    with store._conn() as c:
        c.execute('DROP TRIGGER reject_write')
    reply = Bot(store).handle(CHAT, f'{action} {pid}', TODAY)
    assert '已' in reply
    assert count(store, table) == 1
    Bot(store).handle(CHAT, f'{action} {pid}', TODAY)
    assert count(store, table) == 1


def test_payment_marker_failure_rolls_back_expense(store):
    bid = store.add_bill(SHARED_LEDGER, 'DEMO rent', 500, 15)
    with store._conn() as c:
        c.execute("CREATE TRIGGER reject_payment BEFORE INSERT ON bill_payments BEGIN SELECT RAISE(ABORT, 'injected_failure'); END")
    with pytest.raises(sqlite3.IntegrityError, match='injected_failure'):
        Bot(store).handle(CHAT, f'已付 {bid}', TODAY)
    assert count(store, 'expenses') == 0, 'payment failure must roll back the paired expense'
    assert count(store, 'bill_payments') == 0
    with store._conn() as c:
        c.execute('DROP TRIGGER reject_payment')
    Bot(store).handle(CHAT, f'已付 {bid}', TODAY)
    assert count(store, 'expenses') == count(store, 'bill_payments') == 1


def test_concurrent_bill_payment_records_once(store, monkeypatch):
    bid = store.add_bill(SHARED_LEDGER, 'DEMO rent', 500, 15)
    barrier = Barrier(2)
    original = store.get_bill

    def concurrent_read(*args):
        row = original(*args)
        barrier.wait(timeout=10)
        return row

    monkeypatch.setattr(store, 'get_bill', concurrent_read)
    with ThreadPoolExecutor(max_workers=2) as pool:
        replies = list(pool.map(lambda _: Bot(store).handle(CHAT, f'已付 {bid}', TODAY), range(2)))
    assert count(store, 'expenses') == 1, 'two concurrent commands must not create two expenses'
    assert count(store, 'bill_payments') == 1
    assert sum('已自動記帳' in reply for reply in replies) == 1
    assert sum('已經標記' in reply for reply in replies) == 1


def test_receipt_confirmation_uses_current_locked_values(store, monkeypatch):
    pid = pending(store)
    original = store.get_pending
    edited = False

    def edit_after_read(*args):
        nonlocal edited
        row = original(*args)
        if not edited:
            edited = True
            store.update_pending(pid, amount=999, note='DEMO updated')
        return row

    monkeypatch.setattr(store, 'get_pending', edit_after_read)
    reply = Bot(store).handle(CHAT, f'確認 {pid}', TODAY)
    saved = store.expenses_between(SHARED_LEDGER, TODAY, TODAY)
    assert len(saved) == 1
    assert saved[0]['amount'] == 999
    assert saved[0]['note'] == 'DEMO updated'
    assert '999' in reply and 'DEMO updated' in reply


def test_simultaneous_confirm_and_add_bill_consumes_receipt_once(store, monkeypatch):
    pid = pending(store, 'bill')
    barrier = Barrier(2)
    original = store.get_pending

    def concurrent_read(*args):
        row = original(*args)
        barrier.wait(timeout=10)
        return row

    monkeypatch.setattr(store, 'get_pending', concurrent_read)
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda action: Bot(store).handle(CHAT, f'{action} {pid}', TODAY), ['確認', '加入帳單']))
    assert count(store, 'expenses') + count(store, 'bills') == 1
