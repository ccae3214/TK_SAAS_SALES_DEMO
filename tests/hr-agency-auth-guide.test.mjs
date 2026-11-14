import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '../src/lib/hr-agency-auth-guide.js';

test('every item and stage is valid only for its own side', () => {
  assert.equal(g.isItemOf('taiwan', 'spa'), true);
  assert.equal(g.isItemOf('philippines', 'spa'), false);
  assert.equal(g.isItemOf('philippines', 'dmw_license'), true);
  assert.equal(g.isStageOf('taiwan', 'meco'), true);
  assert.equal(g.isStageOf('philippines', 'meco'), false);
  assert.equal(g.isStageOf('philippines', 'teco'), true);
  assert.equal(g.isItemOf('x', 'spa'), false);
  assert.equal(g.isStageOf(undefined, 'todo'), false);
});

test('every route starts at todo and ends at delivered', () => {
  for (const side of g.SIDES) {
    const stages = g.AUTH_ROUTES[side].stages;
    assert.equal(stages[0], 'todo');
    assert.equal(stages.at(-1), 'delivered');
  }
});

test('itemFraction walks from 0 to 1 across stages', () => {
  assert.equal(g.itemFraction('taiwan', 'todo'), 0);
  assert.equal(g.itemFraction('taiwan', 'delivered'), 1);
  assert.equal(g.itemFraction('taiwan', 'boca'), 0.5);
  assert.equal(g.itemFraction('philippines', 'dfa'), 1 / 3);
  assert.equal(g.itemFraction('philippines', 'nonsense'), 0);
});

test('progressOf: empty, partial and complete', () => {
  assert.deepEqual(g.progressOf('taiwan', []), { done: 0, total: 4, percent: 0 });
  const partial = g.progressOf('taiwan', [{ item_key: 'spa', stage: 'delivered' }, { item_key: 'agency_license', stage: 'boca' }]);
  assert.equal(partial.done, 1);
  assert.equal(partial.percent, Math.round(((1 + 0.5) / 4) * 100));
  const all = g.AUTH_ITEMS.philippines.map(item_key => ({ item_key, stage: 'delivered' }));
  assert.deepEqual(g.progressOf('philippines', all), { done: 2, total: 2, percent: 100 });
  assert.deepEqual(g.progressOf('bogus', []), { done: 0, total: 0, percent: 0 });
});

test('progressOf ignores stages and items that do not belong to the side', () => {
  const result = g.progressOf('philippines', [{ item_key: 'dmw_license', stage: 'meco' }, { item_key: 'spa', stage: 'delivered' }]);
  assert.equal(result.done, 0);
  assert.equal(result.percent, 0);
});

test('pendingItems lists what is not delivered yet', () => {
  assert.deepEqual(g.pendingItems('philippines', [{ item_key: 'dmw_license', stage: 'delivered' }]), ['company_registration']);
  assert.deepEqual(g.pendingItems('taiwan', []), g.AUTH_ITEMS.taiwan);
});

test('estimate: Taiwan documents scale per document and exclude notary fee', () => {
  const one = g.estimateAuthentication('taiwan', { documents: 1 });
  assert.deepEqual(one.fees, [{ currency: 'TWD', min: 1400, max: 1400 }]);
  assert.deepEqual(one.days, { min: 5, max: 5 });
  assert.equal(one.estimated, true);
  assert.deepEqual(one.excluded, ['notary']);
  const four = g.estimateAuthentication('taiwan', { documents: 4 });
  assert.equal(four.fees[0].min, 5600);
});

test('estimate: expedited is faster and costs more', () => {
  const normal = g.estimateAuthentication('taiwan', { documents: 2 });
  const fast = g.estimateAuthentication('taiwan', { documents: 2, expedited: true });
  assert.ok(fast.fees[0].min > normal.fees[0].min);
  assert.ok(fast.days.max < normal.days.max);
});

test('estimate: Philippines side uses PHP ranges', () => {
  const normal = g.estimateAuthentication('philippines', { documents: 2 });
  assert.deepEqual(normal.fees, [{ currency: 'PHP', min: 1600, max: 1800 }]);
  assert.deepEqual(normal.days, { min: 6, max: 8 });
  assert.equal(normal.estimated, false);
  assert.deepEqual(normal.excluded, ['dfa']);
  const fast = g.estimateAuthentication('philippines', { documents: 1, expedited: true });
  assert.deepEqual(fast.fees, [{ currency: 'PHP', min: 1200, max: 1350 }]);
  assert.deepEqual(fast.days, { min: 2, max: 3 });
});

test('estimate: bad inputs are clamped, unknown side is null', () => {
  assert.equal(g.estimateAuthentication('mars'), null);
  assert.equal(g.estimateAuthentication('taiwan', { documents: 0 }).documents, 1);
  assert.equal(g.estimateAuthentication('taiwan', { documents: 'abc' }).documents, 1);
  assert.equal(g.estimateAuthentication('taiwan', { documents: 2.9 }).documents, 2);
});

test('canTrackProgress only for live certifications', () => {
  assert.equal(g.canTrackProgress('pending'), true);
  assert.equal(g.canTrackProgress('certified'), true);
  assert.equal(g.canTrackProgress('rejected'), false);
  assert.equal(g.canTrackProgress('revoked'), false);
});
