import assert from 'node:assert/strict';
import test from 'node:test';
import * as n from '../src/lib/hr-agency-next-steps.js';

const done = (...keys) => keys.map(step_key => ({ step_key, completed_on: '2026-11-01' }));
const open = (...keys) => keys.map(step_key => ({ step_key, completed_on: null }));
const flow = (candidates = [], hired = 0) => ({ candidates: candidates.map(status => ({ status })), hired });

test('order: a fresh order tells Taiwan to confirm the earliest completion with the Philippine agency', () => {
  const guide = n.orderNextSteps({ status: 'open' }, flow(), 'taiwan');
  assert.equal(guide.id, 'order_placed');
  assert.deepEqual(guide.actions, [{ id: 'confirm_eta', with: ['philippines'] }]);
  assert.deepEqual(n.orderNextSteps({ status: 'open' }, flow(), 'philippines').actions, [{ id: 'reply_eta', with: ['taiwan'] }]);
});

test('order: guide follows the matching status', () => {
  assert.equal(n.orderGuideId({ status: 'open' }, flow(['proposed'])), 'candidate_proposed');
  assert.equal(n.orderGuideId({ status: 'open' }, flow(['proposed', 'scheduled'])), 'interview_scheduled');
  assert.equal(n.orderGuideId({ status: 'open' }, flow(['rejected'])), 'order_placed');
  assert.equal(n.orderGuideId({ status: 'open' }, flow(['passed', 'proposed'], 1)), 'candidate_proposed');
  assert.equal(n.orderGuideId({ status: 'open' }, flow(['passed'], 1)), 'hired');
  assert.equal(n.orderGuideId({ status: 'filled' }, flow(['passed'], 1)), 'hired');
});

test('order: cancelled orders, missing data and non-agency viewers get no guide', () => {
  assert.equal(n.orderNextSteps({ status: 'cancelled' }, flow(), 'taiwan'), null);
  assert.equal(n.orderNextSteps(null, flow(), 'taiwan'), null);
  assert.equal(n.orderNextSteps({ status: 'open' }, null, 'taiwan'), null);
  assert.equal(n.orderNextSteps({ status: 'open' }, flow(), 'employer'), null);
  assert.equal(n.orderNextSteps({ status: 'open' }, flow(), undefined), null);
});

test('case: walks through the stages in order', () => {
  assert.equal(n.caseGuideId([]), 'case_started');
  assert.equal(n.caseGuideId(undefined), 'case_started');
  assert.equal(n.caseGuideId(done('match_date')), 'match_done');
  assert.equal(n.caseGuideId(done('match_date', 'passport', 'personal_documents')), 'match_done');
  assert.equal(n.caseGuideId(done('match_date', 'passport', 'personal_documents', 'document_arrival')), 'docs_ready');
  assert.equal(n.caseGuideId(done('passport', 'personal_documents', 'document_arrival', 'visa')), 'one_route_done');
  assert.equal(n.caseGuideId(done('oec')), 'one_route_done');
  assert.equal(n.caseGuideId(done('visa', 'oec')), 'visa_oec_done');
  assert.equal(n.caseGuideId(done('visa', 'oec', 'expected_entry')), 'flight_set');
  assert.equal(n.caseGuideId(done('visa', 'oec', 'ticket')), 'flight_set');
  assert.equal(n.caseGuideId(done('visa', 'oec', 'ticket', 'actual_entry')), 'arrived');
  assert.equal(n.caseGuideId(done('actual_entry', 'entry_notification', 'insurance')), 'arrived');
  assert.equal(n.caseGuideId(done('actual_entry', 'entry_notification', 'insurance', 'arc')), 'all_done');
});

test('case: steps without a completion date do not count', () => {
  assert.equal(n.caseGuideId(open('visa', 'oec', 'ticket', 'actual_entry')), 'case_started');
  assert.equal(n.caseGuideId([...done('visa'), ...open('oec')]), 'one_route_done');
  assert.equal(n.caseGuideId([null, undefined, {}]), 'case_started');
});

test('case: once OEC and visa are done, Taiwan confirms entry with employer, Philippine agency and notification process', () => {
  const guide = n.caseNextSteps(done('visa', 'oec'), 'taiwan');
  assert.equal(guide.id, 'visa_oec_done');
  assert.deepEqual(guide.actions, [{ id: 'confirm_entry_date', with: ['employer', 'philippines', 'notification'] }]);
  assert.deepEqual(n.caseNextSteps(done('visa', 'oec'), 'philippines').actions, [{ id: 'book_ticket', with: ['taiwan', 'employer'] }]);
});

test('case: after arrival Taiwan handles the in-Taiwan documents; finished cases have no actions', () => {
  assert.deepEqual(n.caseNextSteps(done('actual_entry'), 'taiwan').actions, [{ id: 'post_arrival_docs', with: ['notification'] }]);
  assert.deepEqual(n.caseNextSteps(done('actual_entry', 'entry_notification', 'insurance', 'arc'), 'taiwan').actions, []);
  assert.equal(n.caseNextSteps(done('visa'), 'employer'), null);
});

test('every guide has actions for both agency types and only known counterparts', () => {
  const known = new Set(['employer', 'taiwan', 'philippines', 'notification']);
  for (const table of [n.ORDER_GUIDES, n.CASE_GUIDES]) {
    for (const [id, sides] of Object.entries(table)) {
      assert.ok(Array.isArray(sides.taiwan) && Array.isArray(sides.philippines), id);
      for (const item of [...sides.taiwan, ...sides.philippines]) {
        assert.ok(item.id, id);
        for (const who of item.with) assert.ok(known.has(who), `${id}:${who}`);
      }
    }
  }
});
