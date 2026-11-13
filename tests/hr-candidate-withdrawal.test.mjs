import test from 'node:test';
import assert from 'node:assert/strict';
import { WITHDRAWAL_MARKER, canWithdrawRecommendation, isWithdrawnRecommendation, recommendationStatus } from '../src/lib/hr-candidate-withdrawal.js';
import { withdrawRecommendation } from '../src/lib/hr-candidate-withdrawal-store.js';

const principal = { id: 7, role: 'agency', agency_type: 'philippines', agency_id: 2 };
const pending = { id: 8, status: 'proposed', agency_recommendation: true, interview_at: null, case_id: null, order_status: 'open', notes: '原推薦說明' };
const fixedDate = () => new Date('2026-11-10T09:00:00.000Z');
function fixture(row = pending, failUpdate = false) {
  const calls = [];
  let released = false;
  const client = {
    async query(sql, args) {
      calls.push({ sql, args });
      if (sql.startsWith('SELECT')) return { rowCount: row ? 1 : 0, rows: row ? [{ ...row }] : [] };
      if (sql.startsWith('UPDATE')) {
        if (failUpdate) throw new Error('test update failure');
        return { rowCount: 1, rows: [{ id: row.id, status: 'rejected' }] };
      }
      return { rows: [], rowCount: 0 };
    },
    release() { released = true; },
  };
  return { pool: { connect: async () => client }, calls, released: () => released };
}

test('pending agency recommendation is withdrawable', () => assert.equal(canWithdrawRecommendation(pending), true));
for (const [name, change] of [
  ['scheduled', {status:'scheduled'}], ['hired', {status:'passed',case_id:9}], ['rejected', {status:'rejected'}],
  ['interview timestamp', {interview_at:'2026-11-11T09:00:00Z'}], ['case link', {case_id:9}], ['employer selection', {agency_recommendation:false}],
]) test(`${name} is not withdrawable`, () => assert.equal(canWithdrawRecommendation({...pending,...change}),false));
test('withdrawal status is distinct from employer rejection', () => {
  assert.equal(isWithdrawnRecommendation({...pending,status:'rejected',notes:'雇主未錄用'}),false);
  const row={...pending,status:'rejected',notes:pending.notes+WITHDRAWAL_MARKER+'{"memberId":7}'};
  assert.equal(isWithdrawnRecommendation(row),true);
  assert.equal(recommendationStatus(row),'已撤回推薦');
  assert.equal(isWithdrawnRecommendation({...row,status:'proposed'}),false);
});
test('wrong roles are rejected without connecting to DB', async () => {
  for(const actor of [{role:'worker'},{role:'employer'},{role:'admin'},{role:'agency',agency_type:'taiwan'}]) {
    const r=await withdrawRecommendation({connect(){throw new Error('should not connect');}},actor,8);
    assert.equal(r.status,403);
  }
});
test('invalid candidate identifiers are rejected without connecting', async () => {
  for(const id of [null,0,-1,'abc','1 OR 1=1']) assert.equal((await withdrawRecommendation({connect(){throw new Error('should not connect');}},principal,id)).status,400);
});
test('cross-agency or missing candidate fails closed with non-enumerating 404', async () => {
  const f=fixture(null); assert.equal((await withdrawRecommendation(f.pool,principal,8)).status,404);
  const query=f.calls.find(c=>c.sql.startsWith('SELECT'));
  assert.match(query.sql,/r.philippines_agency_id=\$2 AND w.agency_id=\$2/);
  assert.match(query.sql,/FOR UPDATE OF c,o/);
  assert.deepEqual(query.args,[8,2]); assert.equal(f.calls.at(-1).sql,'ROLLBACK'); assert.equal(f.released(),true);
});
test('withdrawal changes only recommendation, appends actor/time, retains original notes', async () => {
  const f=fixture();const r=await withdrawRecommendation(f.pool,principal,8,fixedDate);
  assert.equal(r.status,200);assert.equal(r.body.withdrawn,true);
  const update=f.calls.find(c=>c.sql.startsWith('UPDATE'));
  assert.match(update.sql,/notes=notes \|\| \$2/); assert.match(update.sql,/status='rejected'/);
  assert.deepEqual(JSON.parse(update.args[1].slice(WITHDRAWAL_MARKER.length)),{at:'2026-11-10T09:00:00.000Z',memberId:7});
  assert.equal(f.calls.filter(c=>c.sql.startsWith('UPDATE')).length,1);
  assert.equal(f.calls.some(c=>/DELETE FROM|UPDATE hr_workers|UPDATE hr_cases/.test(c.sql)),false);
  assert.equal(f.calls.at(-1).sql,'COMMIT');assert.equal(f.released(),true);
});
for(const [name, change] of [
  ['scheduled', {status:'scheduled'}],['hired',{status:'passed',case_id:9}],['employer-selected',{agency_recommendation:false}],
  ['cancelled order',{order_status:'cancelled'}],['filled order',{order_status:'filled'}],['interview date',{interview_at:'2026-11-11'}],
]) test(`${name} returns conflict without write`,async()=>{
  const f=fixture({...pending,...change});assert.equal((await withdrawRecommendation(f.pool,principal,8)).status,409);
  assert.equal(f.calls.some(c=>c.sql.startsWith('UPDATE')),false);assert.equal(f.calls.at(-1).sql,'ROLLBACK');assert.equal(f.released(),true);
});
test('retry is idempotent and does not append another event', async () => {
  const f=fixture({...pending,status:'rejected',notes:pending.notes+WITHDRAWAL_MARKER+'{}'});
  const r=await withdrawRecommendation(f.pool,principal,8);assert.equal(r.status,200);assert.equal(r.body.alreadyWithdrawn,true);
  assert.equal(f.calls.some(c=>c.sql.startsWith('UPDATE')),false);assert.equal(f.released(),true);
});
test('failed write rolls back and releases connection',async()=>{
  const f=fixture(pending,true);await assert.rejects(withdrawRecommendation(f.pool,principal,8),/test update failure/);
  assert.equal(f.calls.at(-1).sql,'ROLLBACK');assert.equal(f.released(),true);
});