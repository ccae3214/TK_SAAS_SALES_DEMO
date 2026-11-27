import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCertificationAction, listCertifications, isAgencyPairCertified, isRouteCertified,
  certifiedPhilippinesAgencyIds, assertPhilippinesAgenciesCertified, assertCaseAgenciesCertified,
} from '../src/lib/hr-agency-certification-store.js';

// ---- 記憶體中的假資料庫：只認得這個模組用到的 SQL ----
function certificationDb({ agencies = [], certifications = [], employers = [], workers = [], routes = [] } = {}) {
  const state = { agencies, certifications: certifications.map(row => ({ ...row })), employers, workers, routes, nextId: 100, log: [] };
  const agencyById = id => state.agencies.find(agency => Number(agency.id) === Number(id));
  const joined = row => ({
    ...row, taiwan_agency_name: agencyById(row.taiwan_agency_id)?.name, philippines_agency_name: agencyById(row.philippines_agency_id)?.name,
    philippines_agency_country: agencyById(row.philippines_agency_id)?.country,
  });
  const certified = row => row.status === 'certified' && row.taiwan_confirmed_at && row.philippines_confirmed_at;
  const rows = list => ({ rows: list, rowCount: list.length });
  const query = async (sql, params = []) => {
    const text = sql.replace(/\s+/g, ' ').trim();
    state.log.push(text.split(' ')[0]);
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return rows([]);
    if (text.startsWith('SELECT id,name,agency_type FROM hr_agencies WHERE id=ANY')) {
      return rows(state.agencies.filter(agency => agency.active !== false && params[0].includes(Number(agency.id))));
    }
    if (text.startsWith('INSERT INTO hr_agency_certifications')) {
      const [t, p, status, side, requestedBy, decidedBy, tAt, pAt, source] = params;
      if (state.certifications.some(row => row.taiwan_agency_id === t && row.philippines_agency_id === p)) return rows([]);
      const row = { id: state.nextId++, taiwan_agency_id: t, philippines_agency_id: p, status, requested_by_side: side, requested_by_member_id: requestedBy, decided_by_member_id: decidedBy, taiwan_confirmed_at: tAt, philippines_confirmed_at: pAt, source, note: '' };
      state.certifications.push(row);
      return rows([{ id: row.id }]);
    }
    if (text.startsWith('SELECT * FROM hr_agency_certifications WHERE taiwan_agency_id=$1')) {
      return rows(state.certifications.filter(row => row.taiwan_agency_id === Number(params[0]) && row.philippines_agency_id === Number(params[1])).map(row => ({ ...row })));
    }
    if (text.startsWith('SELECT * FROM hr_agency_certifications WHERE id=$1')) {
      return rows(state.certifications.filter(row => row.id === Number(params[0])).map(row => ({ ...row })));
    }
    if (text.startsWith('UPDATE hr_agency_certifications')) {
      const [id, status, side, requestedBy, decidedBy, tAt, pAt, source] = params;
      Object.assign(state.certifications.find(row => row.id === id), { status, requested_by_side: side, requested_by_member_id: requestedBy, decided_by_member_id: decidedBy, taiwan_confirmed_at: tAt, philippines_confirmed_at: pAt, source });
      return rows([]);
    }
    if (text.includes('FROM hr_agency_certifications c JOIN hr_agencies ta')) {
      let list = state.certifications.map(joined);
      if (text.includes('WHERE c.id=$1')) list = list.filter(row => row.id === Number(params[0]));
      else if (text.includes("WHERE c.taiwan_agency_id=$1 AND c.status='certified'")) list = list.filter(row => row.taiwan_agency_id === Number(params[0]) && row.status === 'certified');
      else if (text.includes('WHERE c.taiwan_agency_id=$1')) list = list.filter(row => row.taiwan_agency_id === Number(params[0]));
      else if (text.includes('WHERE c.philippines_agency_id=$1')) list = list.filter(row => row.philippines_agency_id === Number(params[0]));
      return rows(list);
    }
    if (text.startsWith('SELECT agency_id FROM hr_employers')) return rows(state.employers.filter(e => e.id === Number(params[0])));
    if (text.startsWith('SELECT id,name,agency_type,country FROM hr_agencies')) return rows(state.agencies);
    if (text.startsWith('SELECT id,name,country FROM hr_agencies')) return rows(state.agencies.filter(a => a.agency_type === params[0]));
    if (text.startsWith('SELECT 1 FROM hr_agency_certifications')) {
      return rows(state.certifications.filter(row => row.taiwan_agency_id === Number(params[0]) && row.philippines_agency_id === Number(params[1]) && certified(row)).map(() => ({ '?column?': 1 })));
    }
    if (text.startsWith('SELECT 1 FROM hr_job_order_routes')) {
      const route = state.routes.find(r => r.id === Number(params[0]));
      const ok = route && state.certifications.some(row => row.taiwan_agency_id === route.taiwan_agency_id && row.philippines_agency_id === route.philippines_agency_id && row.status === 'certified');
      return rows(ok ? [{}] : []);
    }
    if (text.startsWith('SELECT philippines_agency_id FROM hr_agency_certifications')) {
      return rows(state.certifications.filter(row => row.taiwan_agency_id === Number(params[0]) && certified(row)));
    }
    if (text.startsWith('SELECT a.name FROM hr_agencies a')) {
      const [orderAgencyId, taiwanId, ids] = params;
      const onOrder = new Set(state.routes.filter(r => r.order_agency_id === orderAgencyId).map(r => r.philippines_agency_id));
      return rows(state.agencies.filter(a => ids.includes(a.id) && !onOrder.has(a.id)
        && !state.certifications.some(row => row.taiwan_agency_id === taiwanId && row.philippines_agency_id === a.id && row.status === 'certified')).map(a => ({ name: a.name })).sort((a, b) => a.name.localeCompare(b.name)));
    }
    if (text.startsWith('SELECT e.agency_id AS taiwan_agency_id')) {
      const employer = state.employers.find(e => e.id === params[0]);
      const worker = state.workers.find(w => w.id === params[1]);
      if (!employer || !worker) return rows([]);
      return rows([{ taiwan_agency_id: employer.agency_id, philippines_agency_id: worker.agency_id, taiwan_agency_name: agencyById(employer.agency_id)?.name, philippines_agency_name: agencyById(worker.agency_id)?.name }]);
    }
    throw new Error(`unexpected SQL: ${text.slice(0, 80)}`);
  };
  let released = 0;
  return { state, query, connect: async () => ({ query, release: () => { released++; } }), get released() { return released; } };
}

const AGENCIES = [
  { id: 1, name: '台灣甲', agency_type: 'taiwan', country: 'TW' },
  { id: 2, name: 'Manila A', agency_type: 'philippines', country: 'PH' },
  { id: 3, name: 'Cebu B', agency_type: 'philippines', country: 'PH' },
  { id: 4, name: '停用仲介', agency_type: 'philippines', active: false },
];
const taiwanAdmin = { id: 11, role: 'agency', agency_type: 'taiwan', agency_id: 1, is_agency_admin: true };
const manilaAdmin = { id: 22, role: 'agency', agency_type: 'philippines', agency_id: 2, is_agency_admin: true };
const cebuAdmin = { id: 33, role: 'agency', agency_type: 'philippines', agency_id: 3, is_agency_admin: true };
const systemAdmin = { id: 1, role: 'admin' };
const clock = () => new Date('2026-05-01T00:00:00Z');
const STAMP = '2026-05-01T00:00:00.000Z';
const act = (db, principal, input) => applyCertificationAction(db, principal, input, clock);

test('權限：不合法的操作、非仲介、非仲介管理者、管理者申請、仲介直接認證都被擋下，不會開交易', async () => {
  const db = certificationDb({ agencies: AGENCIES });
  assert.equal((await act(db, taiwanAdmin, { action: 'hack' })).status, 400);
  assert.equal((await act(db, { role: 'employer' }, { action: 'request' })).status, 403);
  assert.equal((await act(db, { role: 'agency', agency_type: 'other', agency_id: 1 }, { action: 'request' })).status, 403);
  assert.equal((await act(db, { ...taiwanAdmin, is_agency_admin: false }, { action: 'request' })).status, 403);
  assert.equal((await act(db, systemAdmin, { action: 'request' })).status, 403);
  assert.equal((await act(db, taiwanAdmin, { action: 'certify' })).status, 403);
  assert.deepEqual(db.state.log, []);
});

test('申請 → 對方同意：雙方都確認後才算認證完成，並記錄稽核內容', async () => {
  const db = certificationDb({ agencies: AGENCIES });
  const requested = await act(db, taiwanAdmin, { action: 'request', counterpartAgencyId: 2 });
  assert.equal(requested.status, 201);
  assert.equal(requested.audit.key, 'request');
  assert.match(requested.audit.zh, /台灣甲.*Manila A/);
  const row = db.state.certifications[0];
  assert.deepEqual([row.status, row.requested_by_side, row.taiwan_confirmed_at, row.philippines_confirmed_at], ['pending', 'taiwan', STAMP, null]);
  assert.deepEqual(requested.body.certification.actions, ['revoke'], '申請方只能撤回');
  assert.equal(await isAgencyPairCertified(db, 1, 2), false);

  const selfApprove = await act(db, taiwanAdmin, { action: 'approve', id: row.id });
  assert.equal(selfApprove.status, 409, '不能自己同意自己的申請');
  const approved = await act(db, manilaAdmin, { action: 'approve', id: row.id });
  assert.equal(approved.status, 200);
  assert.equal(approved.audit.key, 'approve');
  assert.deepEqual([row.status, row.philippines_confirmed_at, row.decided_by_member_id], ['certified', STAMP, 22]);
  assert.equal(await isAgencyPairCertified(db, 1, 2), true);
  assert.deepEqual([...await certifiedPhilippinesAgencyIds(db, 1)], [2]);
  assert.equal(db.released, 3);
});

test('雙方互相申請等於同意；重複申請回報已在申請中或已認證', async () => {
  const db = certificationDb({ agencies: AGENCIES });
  await act(db, manilaAdmin, { action: 'request', counterpartAgencyId: 1 });
  const again = await act(db, manilaAdmin, { action: 'request', counterpartAgencyId: 1 });
  assert.equal(again.body.already, 'pending');
  assert.equal(again.audit, null);
  const crossed = await act(db, taiwanAdmin, { action: 'request', counterpartAgencyId: 2 });
  assert.equal(crossed.body.completed, true);
  assert.equal(db.state.certifications[0].status, 'certified');
  const already = await act(db, taiwanAdmin, { action: 'request', counterpartAgencyId: 2 });
  assert.equal(already.body.already, 'certified');
});

test('拒絕、撤回、解除與重新申請', async () => {
  const db = certificationDb({ agencies: AGENCIES });
  await act(db, taiwanAdmin, { action: 'request', counterpartAgencyId: 2 });
  const id = db.state.certifications[0].id;
  assert.equal((await act(db, taiwanAdmin, { action: 'reject', id })).status, 409, '申請方要用撤回，不是拒絕');
  const rejected = await act(db, manilaAdmin, { action: 'reject', id });
  assert.deepEqual([rejected.status, rejected.audit.key, db.state.certifications[0].status], [200, 'return', 'rejected']);
  assert.equal((await act(db, manilaAdmin, { action: 'approve', id })).status, 409, '已拒絕的不能再同意');
  assert.equal((await act(db, manilaAdmin, { action: 'revoke', id })).status, 409, '已拒絕的不能撤回');

  const reopened = await act(db, manilaAdmin, { action: 'request', counterpartAgencyId: 1 });
  assert.equal(reopened.body.reopened, true);
  assert.deepEqual([db.state.certifications[0].status, db.state.certifications[0].requested_by_side, db.state.certifications[0].taiwan_confirmed_at], ['pending', 'philippines', null]);
  assert.equal((await act(db, taiwanAdmin, { action: 'revoke', id })).status, 409, '對方提出的申請要用拒絕');
  const withdrawn = await act(db, manilaAdmin, { action: 'revoke', id });
  assert.deepEqual([withdrawn.audit.key, withdrawn.audit.action, db.state.certifications[0].status], ['withdraw', '撤回申請', 'revoked']);

  await act(db, taiwanAdmin, { action: 'request', counterpartAgencyId: 2 });
  await act(db, manilaAdmin, { action: 'approve', id });
  const revoked = await act(db, taiwanAdmin, { action: 'revoke', id });
  assert.deepEqual([revoked.audit.key, revoked.audit.action, revoked.audit.en.startsWith('Revoked'), db.state.certifications[0].status], ['disable', '解除認證', true, 'revoked']);
});

test('系統管理者直接認證新的或既有的組合，也可以同意、拒絕或撤回任何一方的申請', async () => {
  const db = certificationDb({ agencies: AGENCIES });
  const created = await act(db, systemAdmin, { action: 'certify', taiwanAgencyId: 1, philippinesAgencyId: 2 });
  assert.equal(created.status, 201);
  assert.deepEqual([db.state.certifications[0].status, db.state.certifications[0].source], ['certified', 'admin']);
  await act(db, cebuAdmin, { action: 'request', counterpartAgencyId: 1 });
  const cebuRow = db.state.certifications[1];
  const forced = await act(db, systemAdmin, { action: 'certify', taiwanAgencyId: 1, philippinesAgencyId: 3 });
  assert.deepEqual([forced.status, forced.audit.key, cebuRow.status, cebuRow.taiwan_confirmed_at], [200, 'approve', 'certified', STAMP]);

  await act(db, systemAdmin, { action: 'revoke', id: cebuRow.id });
  await act(db, cebuAdmin, { action: 'request', counterpartAgencyId: 1 });
  assert.equal((await act(db, systemAdmin, { action: 'approve', id: cebuRow.id })).status, 200);
  await act(db, systemAdmin, { action: 'revoke', id: cebuRow.id });
  await act(db, cebuAdmin, { action: 'request', counterpartAgencyId: 1 });
  assert.equal((await act(db, systemAdmin, { action: 'reject', id: cebuRow.id })).status, 200);
  await act(db, cebuAdmin, { action: 'request', counterpartAgencyId: 1 });
  assert.equal((await act(db, systemAdmin, { action: 'revoke', id: cebuRow.id })).audit.key, 'withdraw', '管理者也可以撤回尚未確認的申請');
});

test('輸入不合法、對方不是啟用中的另一國仲介、看不到別人的紀錄：失敗並 ROLLBACK', async () => {
  const db = certificationDb({ agencies: AGENCIES });
  for (const [principal, input, status] of [
    [taiwanAdmin, { action: 'request' }, 400],
    [systemAdmin, { action: 'certify', taiwanAgencyId: 1 }, 400],
    [taiwanAdmin, { action: 'request', counterpartAgencyId: 4 }, 400],
    [taiwanAdmin, { action: 'request', counterpartAgencyId: 1 }, 400],
    [taiwanAdmin, { action: 'approve', id: 'x' }, 400],
    [taiwanAdmin, { action: 'approve', id: 999 }, 404],
  ]) assert.equal((await act(db, principal, input)).status, status, JSON.stringify(input));
  await act(db, taiwanAdmin, { action: 'request', counterpartAgencyId: 2 });
  assert.equal((await act(db, cebuAdmin, { action: 'approve', id: db.state.certifications[0].id })).status, 404, '不透露其他機構的紀錄');
  assert.equal(db.state.log.filter(step => step === 'ROLLBACK').length, 7, '每一次失敗都 ROLLBACK');
  assert.equal(db.state.log.filter(step => step === 'COMMIT').length, 1, '只有成功的申請 COMMIT');
});

test('交易中發生錯誤會 ROLLBACK 並釋放連線', async () => {
  const db = certificationDb({ agencies: AGENCIES });
  const broken = { connect: async () => ({ query: async sql => { if (sql.includes('hr_agencies')) throw new Error('db down'); return db.query(sql); }, release: () => { db.state.log.push('release'); } }) };
  await assert.rejects(act(broken, taiwanAdmin, { action: 'request', counterpartAgencyId: 2 }), /db down/);
  assert.deepEqual(db.state.log, ['BEGIN', 'ROLLBACK', 'release']);
});

test('列表：管理者看全部；仲介只看自己的並附可做的動作；雇主只看所屬仲介已認證的', async () => {
  const db = certificationDb({ agencies: AGENCIES, employers: [{ id: 5, agency_id: 1 }, { id: 6, agency_id: null }] });
  await act(db, taiwanAdmin, { action: 'request', counterpartAgencyId: 2 });
  await act(db, systemAdmin, { action: 'certify', taiwanAgencyId: 1, philippinesAgencyId: 3 });

  const admin = await listCertifications(db, systemAdmin);
  assert.equal(admin.body.role, 'admin');
  assert.equal(admin.body.certifications.length, 2);
  assert.deepEqual(admin.body.taiwanAgencies.map(a => a.id), [1]);
  assert.ok(admin.body.certifications.every(row => row.actions.length === 0 && row.status_label));

  const manila = await listCertifications(db, manilaAdmin);
  assert.deepEqual([manila.body.side, manila.body.canManage, manila.body.certifications.length], ['philippines', true, 1]);
  assert.deepEqual(manila.body.certifications[0].actions, ['approve', 'reject']);
  assert.deepEqual(manila.body.counterparts.map(a => a.id), [1]);

  const employer = await listCertifications(db, { role: 'employer', employer_id: 5 });
  assert.deepEqual(employer.body.certifications.map(row => row.philippines_agency_id), [3]);
  assert.deepEqual((await listCertifications(db, { role: 'employer', employer_id: 6 })).body.certifications, []);
  assert.equal((await listCertifications(db, { role: 'employer' })).status, 403);
  assert.equal((await listCertifications(db, { role: 'worker' })).status, 403);
});

test('其他路由用的檢查：路線、指派菲律賓仲介、建立案件', async () => {
  const db = certificationDb({
    agencies: AGENCIES,
    routes: [{ id: 1, order_agency_id: 7, taiwan_agency_id: 1, philippines_agency_id: 2 }, { id: 2, order_agency_id: 7, taiwan_agency_id: 1, philippines_agency_id: 3 }],
    employers: [{ id: 5, agency_id: 1 }, { id: 6, agency_id: null }], workers: [{ id: 8, agency_id: 2 }, { id: 9, agency_id: 3 }],
  });
  await act(db, systemAdmin, { action: 'certify', taiwanAgencyId: 1, philippinesAgencyId: 2 });
  assert.equal(await isRouteCertified(db, 1), true);
  assert.equal(await isRouteCertified(db, 2), false);
  assert.equal(await isRouteCertified(db, 'x'), false);
  assert.equal(await isAgencyPairCertified(db, 0, 2), false);
  assert.deepEqual([...await certifiedPhilippinesAgencyIds(db, null)], []);

  assert.deepEqual(await assertPhilippinesAgenciesCertified(db, 7, 1, []), []);
  assert.deepEqual(await assertPhilippinesAgenciesCertified(db, 8, 1, [2, 3]), ['Cebu B'], '新加入、未認證的才列出');
  assert.deepEqual(await assertPhilippinesAgenciesCertified(db, 7, 1, [3]), [], '已經在需求單上的路線不重驗');

  assert.equal(await assertCaseAgenciesCertified(db, 5, 8), null);
  assert.match(await assertCaseAgenciesCertified(db, 5, 9), /台灣甲.*Cebu B.*尚未完成相互認證/);
  assert.equal(await assertCaseAgenciesCertified(db, 6, 9), null, '舊資料沒有指派仲介就不限制');
  assert.equal(await assertCaseAgenciesCertified(db, 99, 9), null);
});
