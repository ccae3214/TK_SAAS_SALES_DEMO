import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendarEvents, groupEventsByDate, monthGrid, normalizeDate, shiftMonth, toDateKey } from '../src/lib/hr-admin-calendar.js';

const cases = [{ id: 1, case_number: 'C-001', worker_name: 'Maria' }, { id: 2, case_number: 'C-002', worker_name: 'Ana' }];

test('normalizeDate 只接受真的存在的日期', () => {
  assert.equal(normalizeDate('2026-11-24'), '2026-11-24');
  assert.equal(normalizeDate('2026-11-24T16:00:00.000Z'), '2026-11-24');
  for (const bad of ['', null, undefined, '2026-02-30', '2026/11/24', 'abc', '2026-13-01']) assert.equal(normalizeDate(bad), '', String(bad));
});

test('案件進度：開始與完成不同天會分成兩筆並標示 phase；同一天只有一筆', () => {
  const events = buildCalendarEvents({ cases, applicationSteps: [
    { case_id: 1, step_key: 'visa', label: 'VISA', started_on: '2026-11-03', completed_on: '2026-11-10' },
    { case_id: 1, step_key: 'passport', label: '護照確認', started_on: null, completed_on: '2026-11-05' },
    { case_id: 2, step_key: 'oec', label: 'OEC', started_on: '2026-11-07', completed_on: '2026-11-07' },
  ] });
  assert.deepEqual(events.map(item => [item.date, item.title, item.phase]), [
    ['2026-11-03', 'VISA', 'start'], ['2026-11-05', '護照確認', ''], ['2026-11-07', 'OEC', ''], ['2026-11-10', 'VISA', 'done'],
  ]);
  assert.equal(events[0].detail, 'Maria · C-001');
  assert.equal(events[0].caseId, 1);
});

test('找不到案件的進度、沒有日期的進度不會出現', () => {
  const events = buildCalendarEvents({ cases, applicationSteps: [
    { case_id: 99, step_key: 'visa', label: 'VISA', completed_on: '2026-11-10' },
    { case_id: 1, step_key: 'arc', label: 'ARC', started_on: null, completed_on: null },
    { case_id: 1, step_key: 'arc2', label: 'ARC', completed_on: '2026-02-30' },
  ] });
  assert.deepEqual(events, []);
});

test('待辦：只列未完成且有到期日的；需求單：只列有預計開始日且未取消', () => {
  const events = buildCalendarEvents({
    cases,
    tasks: [
      { id: 1, case_id: 1, title: '補護照', status: 'todo', due_date: '2026-11-12', case_number: 'C-001', worker_name: 'Maria' },
      { id: 2, case_id: 1, title: '已完成', status: 'done', due_date: '2026-11-12' },
      { id: 3, case_id: 1, title: '沒日期', status: 'todo', due_date: null },
      { id: 4, case_id: 2, title: '受阻', status: 'blocked', due_date: '2026-11-01T00:00:00.000Z' },
    ],
    jobOrders: [
      { id: 7, job_type: '家庭看護', employer_name: '王先生', expected_start_date: '2026-11-12', status: 'open' },
      { id: 8, job_type: '工廠', employer_name: '李先生', expected_start_date: '2026-11-15', status: 'cancelled' },
      { id: 9, job_type: '家庭幫傭', employer_name: '張先生', expected_start_date: null, status: 'open' },
    ],
  });
  assert.deepEqual(events.map(item => item.id), ['task:4', 'task:1', 'order:7']);
  assert.equal(events[1].detail, 'Maria · C-001');
  assert.equal(events[2].detail, '王先生');
});

test('同一天依 進度、待辦、需求單 排序', () => {
  const events = buildCalendarEvents({
    cases,
    applicationSteps: [{ case_id: 1, step_key: 'a', label: 'A', completed_on: '2026-11-12' }],
    tasks: [{ id: 1, case_id: 1, title: 'T', status: 'todo', due_date: '2026-11-12' }],
    jobOrders: [{ id: 1, job_type: 'O', expected_start_date: '2026-11-12', status: 'open' }],
  });
  assert.deepEqual(events.map(item => item.kind), ['step', 'task', 'order']);
  const grouped = groupEventsByDate(events);
  assert.equal(grouped.get('2026-11-12').length, 3);
  assert.equal(grouped.get('2026-11-13'), undefined);
});

test('monthGrid：每週從星期日開始，2026 年 11 月 1 日是星期日', () => {
  const weeks = monthGrid(2026, 10);
  assert.equal(weeks.length, 5);
  assert.ok(weeks.every(week => week.length === 7));
  assert.equal(weeks[0][0].date, '2026-11-01');
  assert.equal(weeks[0][0].inMonth, true);
  assert.equal(weeks.at(-1).at(-1).date, '2026-12-05');
  assert.equal(weeks.at(-1).at(-1).inMonth, false);
});

test('monthGrid：月初不是星期日時補上上個月；需要 6 週的月份給 6 週；跨年與閏年', () => {
  const march = monthGrid(2026, 2);
  assert.equal(march[0][0].date, '2026-03-01');
  const may = monthGrid(2026, 4);
  assert.equal(may[0][0].date, '2026-04-26');
  assert.equal(may[0][0].inMonth, false);
  assert.equal(may[0][5].date, '2026-05-01');
  assert.equal(monthGrid(2026, 7).length, 6);
  const feb = monthGrid(2028, 1).flat().filter(cell => cell.inMonth);
  assert.equal(feb.length, 29);
  const jan = monthGrid(2027, 0);
  assert.equal(jan[0][0].date, '2026-12-27');
});

test('shiftMonth 與 toDateKey', () => {
  assert.deepEqual(shiftMonth(2026, 10, 1), { year: 2026, month: 11 });
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftMonth(2026, 5, -18), { year: 2024, month: 11 });
  assert.equal(toDateKey(2026, 0, 5), '2026-01-05');
});
