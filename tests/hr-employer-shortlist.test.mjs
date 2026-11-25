import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { swipeDecision, shortlistView, decideWorker, shortlistExperience } from '../src/lib/hr-employer-shortlist.js';
const workers = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
test('horizontal swipe requires distance and dominant direction; vertical, short and invalid gestures do nothing', () => {
  assert.equal(swipeDecision(72, 0), 'keep'); assert.equal(swipeDecision(-72, 0), 'skip');
  for (const [x,y] of [[71,0],[20,200],[80,100],[NaN,0],[Infinity,0],[90,Infinity]]) assert.equal(swipeDecision(x,y), null);
});
test('skip and keep do not mutate workers, prevent duplicates and can be undone', () => {
  let history = decideWorker([], workers, 1, 'skip');
  assert.equal(shortlistView(workers, history).current.id, 2);
  history = decideWorker(history, workers, 2, 'keep');
  let view = shortlistView(workers, history);
  assert.deepEqual(view.selected.map(w => w.id), [2]); assert.equal(view.remaining, 1);
  assert.equal(shortlistView(workers, history.slice(0,-1)).current.id, 2);
  history = decideWorker(history, workers, 2, 'keep'); assert.equal(history.length, 2);
  assert.deepEqual(workers.map(w => w.id), [1,2,3]);
});
test('availability changes remove stale selections and reordering does not attach a choice to another worker', () => {
  const history = [{ id:'1', decision:'keep' }, { id:'2', decision:'skip' }];
  assert.deepEqual(shortlistView([workers[2],workers[0]],history).selected.map(w=>w.id),[1]);
  assert.equal(shortlistView([workers[2],workers[0]],history).current.id,3);
  assert.deepEqual(shortlistView([], history), { history:[], current:null, selected:[], remaining:0 });
});
test('structured experience is displayed without inventing missing details; legacy profiles still work', () => {
  assert.equal(shortlistExperience({ employmentExperiences:[null,{workplace:'Care center',period:'2022–2025',title:'Caregiver',content:'Daily care'}] }), 'Care center / 2022–2025 / Caregiver / Daily care');
  assert.equal(shortlistExperience({ employmentHistory:'Legacy history' }), 'Legacy history');
  assert.equal(shortlistExperience({}), '');
});
test('unknown workers and decisions are not accepted; independent histories isolate requests', () => {
  const empty = []; assert.equal(decideWorker(empty,workers,99,'keep'),empty);
  assert.equal(decideWorker(empty,workers,1,'hire'),empty);
  const a = decideWorker([],workers,1,'keep');
  assert.equal(shortlistView(workers,[]).selected.length,0); assert.equal(shortlistView(workers,a).selected.length,1);
});
test('portal uses existing eligibility and API, returns failures, and keys drafts by request and job type', async () => {
  const portal = await readFile(new URL('../src/components/HrMemberPortal.jsx',import.meta.url),'utf8');
  assert.match(portal,/orderJourney\(order,data.orderAgencies,data.orderRoutes,data.orderCandidates\).actionable/);
  assert.match(portal,/worker.job_preference===order.job_type&&!selectedWorkerIds.has/);
  assert.match(portal,/async function selectOrderWorker\(order,worker\)\{return submitWorkflow\(\{type:'job-order-employer-candidate',orderId:order.id,workerId:worker.id\}\);\}/);
  assert.ok(portal.includes('key={`${order.id}:${order.job_type}`}'));
  const component = await readFile(new URL('../src/components/HrEmployerShortlist.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(component,/localStorage|sessionStorage|method:\s*['"]POST/);
  assert.match(component,/lock.current = true/); assert.match(component,/if \(!result\)/);
  const css = await readFile(new URL('../src/components/HrEmployerShortlist.module.css',import.meta.url),'utf8');
  assert.match(css,/touch-action:pan-y pinch-zoom/); assert.match(css,/prefers-reduced-motion/); assert.match(css,/focus-visible/);
});
