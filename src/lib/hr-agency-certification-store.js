import {
  AGENCY_ADMIN_REQUIRED_MESSAGE, CERTIFICATION_ACTIONS, CERTIFICATION_SOURCE_LABELS, CERTIFICATION_STATUS_LABELS,
  availableActions, otherSide, sideOfAgencyType,
} from './hr-agency-certification.js';

// 資料表、驗證與交易邏輯。不 import '@/…'，所以 node:test 可以直接用假的 pool 測試。
// db 只需要有 query(sql, params)；pool 需要 connect()（與 hr-candidate-withdrawal-store.js 相同做法）。

const TABLE_SQL = `CREATE TABLE IF NOT EXISTS hr_agency_certifications (
  id BIGSERIAL PRIMARY KEY,
  taiwan_agency_id BIGINT NOT NULL REFERENCES hr_agencies(id) ON DELETE CASCADE,
  philippines_agency_id BIGINT NOT NULL REFERENCES hr_agencies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','certified','rejected','revoked')),
  requested_by_side TEXT CHECK (requested_by_side IN ('taiwan','philippines')),
  requested_by_member_id BIGINT REFERENCES hr_members(id) ON DELETE SET NULL,
  decided_by_member_id BIGINT REFERENCES hr_members(id) ON DELETE SET NULL,
  taiwan_confirmed_at TIMESTAMPTZ,
  philippines_confirmed_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'request' CHECK (source IN ('request','admin','grandfathered')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(taiwan_agency_id, philippines_agency_id),
  CHECK (status <> 'pending' OR requested_by_side IS NOT NULL),
  CHECK (status <> 'certified' OR (taiwan_confirmed_at IS NOT NULL AND philippines_confirmed_at IS NOT NULL))
)`;

// 導入認證機制前，已經有案件或媒合路線的台灣／菲律賓仲介組合視為已認證，避免進行中的案件被切斷。
// ON CONFLICT DO NOTHING：之後被撤銷或拒絕的組合不會被這段重新打開。
const GRANDFATHER_SQL = `INSERT INTO hr_agency_certifications(taiwan_agency_id,philippines_agency_id,status,requested_by_side,taiwan_confirmed_at,philippines_confirmed_at,source,note)
  SELECT pair.t,pair.p,'certified','taiwan',NOW(),NOW(),'grandfathered','導入相互認證前已有案件或媒合紀錄，自動沿用'
  FROM (
    SELECT e.agency_id AS t, w.agency_id AS p FROM hr_cases c JOIN hr_employers e ON e.id=c.employer_id JOIN hr_workers w ON w.id=c.worker_id
    UNION
    SELECT oa.taiwan_agency_id AS t, r.philippines_agency_id AS p FROM hr_job_order_routes r JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id
  ) pair
  JOIN hr_agencies ta ON ta.id=pair.t AND ta.agency_type='taiwan'
  JOIN hr_agencies pa ON pa.id=pair.p AND pa.agency_type='philippines'
  WHERE pair.t IS NOT NULL AND pair.p IS NOT NULL
  ON CONFLICT(taiwan_agency_id,philippines_agency_id) DO NOTHING`;

export async function ensureCertificationSchema(db) {
  await db.query(TABLE_SQL);
  await db.query('CREATE INDEX IF NOT EXISTS hr_agency_certifications_philippines ON hr_agency_certifications(philippines_agency_id, status)');
  await db.query(GRANDFATHER_SQL);
}

const validId = value => /^\d+$/.test(String(value ?? '')) && Number(value) > 0;
const fail = (status, error) => ({ status, body: { error } });
const ROW_SQL = `SELECT c.id,c.taiwan_agency_id,c.philippines_agency_id,c.status,c.requested_by_side,c.taiwan_confirmed_at,c.philippines_confirmed_at,
    c.source,c.note,c.created_at,c.updated_at,ta.name AS taiwan_agency_name,pa.name AS philippines_agency_name,pa.country AS philippines_agency_country
  FROM hr_agency_certifications c JOIN hr_agencies ta ON ta.id=c.taiwan_agency_id JOIN hr_agencies pa ON pa.id=c.philippines_agency_id`;

// ---- 給 /api/hr 與其他路由使用的查詢輔助 ----

export async function isAgencyPairCertified(db, taiwanAgencyId, philippinesAgencyId) {
  if (!validId(taiwanAgencyId) || !validId(philippinesAgencyId)) return false;
  const result = await db.query(`SELECT 1 FROM hr_agency_certifications
    WHERE taiwan_agency_id=$1 AND philippines_agency_id=$2 AND status='certified' AND taiwan_confirmed_at IS NOT NULL AND philippines_confirmed_at IS NOT NULL`, [taiwanAgencyId, philippinesAgencyId]);
  return (result.rows?.length ?? result.rowCount ?? 0) > 0;
}

// 需求單的某條「台灣仲介 → 菲律賓仲介」路線目前是否仍有有效認證。
export async function isRouteCertified(db, routeId) {
  if (!validId(routeId)) return false;
  const result = await db.query(`SELECT 1 FROM hr_job_order_routes r JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id
    JOIN hr_agency_certifications ac ON ac.taiwan_agency_id=oa.taiwan_agency_id AND ac.philippines_agency_id=r.philippines_agency_id AND ac.status='certified'
    WHERE r.id=$1`, [routeId]);
  return (result.rows?.length ?? result.rowCount ?? 0) > 0;
}

// 某台灣仲介已相互認證的菲律賓仲介編號。
export async function certifiedPhilippinesAgencyIds(db, taiwanAgencyId) {
  if (!validId(taiwanAgencyId)) return new Set();
  const result = await db.query(`SELECT philippines_agency_id FROM hr_agency_certifications
    WHERE taiwan_agency_id=$1 AND status='certified' AND taiwan_confirmed_at IS NOT NULL AND philippines_confirmed_at IS NOT NULL`, [taiwanAgencyId]);
  return new Set((result.rows || []).map(row => Number(row.philippines_agency_id)));
}

// 管理者指派菲律賓仲介到需求單時：本次「新加入」的仲介都必須已認證；回傳未認證的仲介名稱。
// 已經在這張需求單上的路線不重驗，避免管理者儲存其他變更時被舊紀錄擋住。
export async function assertPhilippinesAgenciesCertified(db, orderAgencyId, taiwanAgencyId, agencyIds) {
  if (!agencyIds.length) return [];
  const result = await db.query(`SELECT a.name FROM hr_agencies a WHERE a.id=ANY($3::bigint[])
    AND NOT EXISTS(SELECT 1 FROM hr_job_order_routes r WHERE r.order_agency_id=$1 AND r.philippines_agency_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM hr_agency_certifications ac WHERE ac.taiwan_agency_id=$2 AND ac.philippines_agency_id=a.id AND ac.status='certified')
    ORDER BY a.name`, [orderAgencyId, taiwanAgencyId, agencyIds]);
  return (result.rows || []).map(row => row.name);
}

// 管理者直接建立案件時：雇主與工作者各自所屬的仲介必須已相互認證。任一方未指派仲介則不限制（舊資料）。
export async function assertCaseAgenciesCertified(db, employerId, workerId) {
  const result = await db.query(`SELECT e.agency_id AS taiwan_agency_id,w.agency_id AS philippines_agency_id,ta.name AS taiwan_agency_name,pa.name AS philippines_agency_name
    FROM hr_employers e CROSS JOIN hr_workers w
    LEFT JOIN hr_agencies ta ON ta.id=e.agency_id LEFT JOIN hr_agencies pa ON pa.id=w.agency_id
    WHERE e.id=$1 AND w.id=$2`, [employerId, workerId]);
  const pair = result.rows?.[0];
  if (!pair || !pair.taiwan_agency_id || !pair.philippines_agency_id) return null;
  if (await isAgencyPairCertified(db, pair.taiwan_agency_id, pair.philippines_agency_id)) return null;
  return `台灣仲介「${pair.taiwan_agency_name}」與菲律賓仲介「${pair.philippines_agency_name}」尚未完成相互認證，不能建立案件。`;
}

// ---- 讀取 ----

function actorContext(principal) {
  if (principal?.role === 'admin') return { admin: true };
  if (principal?.role === 'agency' && validId(principal.agency_id)) {
    const side = sideOfAgencyType(principal.agency_type);
    if (side) return { admin: false, side, agencyId: Number(principal.agency_id) };
  }
  return null;
}

const decorate = (row, viewerSide) => ({ ...row, status_label: CERTIFICATION_STATUS_LABELS[row.status] || row.status, source_label: CERTIFICATION_SOURCE_LABELS[row.source] || row.source, actions: viewerSide ? availableActions(row, viewerSide) : [] });

export async function listCertifications(db, principal) {
  if (principal?.role === 'employer') {
    if (!validId(principal.employer_id)) return fail(403, '找不到雇主資料。');
    const employer = (await db.query('SELECT agency_id FROM hr_employers WHERE id=$1', [principal.employer_id])).rows?.[0];
    if (!employer?.agency_id) return { status: 200, body: { role: 'employer', agencyId: null, certifications: [], counterparts: [] } };
    const rows = (await db.query(`${ROW_SQL} WHERE c.taiwan_agency_id=$1 AND c.status='certified' AND ta.active=TRUE AND pa.active=TRUE ORDER BY pa.name`, [employer.agency_id])).rows || [];
    return { status: 200, body: { role: 'employer', agencyId: Number(employer.agency_id), certifications: rows.map(row => decorate(row, null)), counterparts: [] } };
  }
  const ctx = actorContext(principal);
  if (!ctx) return fail(403, '僅仲介機構、雇主或系統管理者可以查看相互認證。');
  if (ctx.admin) {
    const rows = (await db.query(`${ROW_SQL} ORDER BY c.updated_at DESC, c.id DESC`)).rows || [];
    const agencies = (await db.query("SELECT id,name,agency_type,country FROM hr_agencies WHERE active=TRUE ORDER BY agency_type,name")).rows || [];
    return { status: 200, body: { role: 'admin', certifications: rows.map(row => decorate(row, null)), taiwanAgencies: agencies.filter(a => a.agency_type === 'taiwan'), philippinesAgencies: agencies.filter(a => a.agency_type === 'philippines') } };
  }
  const column = ctx.side === 'taiwan' ? 'taiwan_agency_id' : 'philippines_agency_id';
  const rows = (await db.query(`${ROW_SQL} WHERE c.${column}=$1 ORDER BY c.updated_at DESC, c.id DESC`, [ctx.agencyId])).rows || [];
  const counterparts = (await db.query('SELECT id,name,country FROM hr_agencies WHERE active=TRUE AND agency_type=$1 ORDER BY name', [otherSide(ctx.side) === 'taiwan' ? 'taiwan' : 'philippines'])).rows || [];
  return { status: 200, body: { role: 'agency', side: ctx.side, agencyId: ctx.agencyId, canManage: !!principal.is_agency_admin, certifications: rows.map(row => decorate(row, ctx.side)), counterparts } };
}

// ---- 寫入（單一交易；所有欄位在 JS 內算好，只用一條 INSERT／UPDATE 寫入）----

const STAMP = { taiwan: 'taiwan_confirmed_at', philippines: 'philippines_confirmed_at' };

async function insertRow(client, row) {
  const result = await client.query(`INSERT INTO hr_agency_certifications(taiwan_agency_id,philippines_agency_id,status,requested_by_side,requested_by_member_id,decided_by_member_id,taiwan_confirmed_at,philippines_confirmed_at,source)
    VALUES($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9) ON CONFLICT(taiwan_agency_id,philippines_agency_id) DO NOTHING RETURNING id`,
  [row.taiwan_agency_id, row.philippines_agency_id, row.status, row.requested_by_side, row.requested_by_member_id, row.decided_by_member_id, row.taiwan_confirmed_at, row.philippines_confirmed_at, row.source]);
  return result.rows?.[0]?.id ?? null;
}

async function updateRow(client, row) {
  await client.query(`UPDATE hr_agency_certifications SET status=$2,requested_by_side=$3,requested_by_member_id=$4,decided_by_member_id=$5,
    taiwan_confirmed_at=$6::timestamptz,philippines_confirmed_at=$7::timestamptz,source=$8,updated_at=NOW() WHERE id=$1`,
  [row.id, row.status, row.requested_by_side, row.requested_by_member_id, row.decided_by_member_id, row.taiwan_confirmed_at, row.philippines_confirmed_at, row.source]);
}

async function reload(client, id, viewerSide) {
  const row = (await client.query(`${ROW_SQL} WHERE c.id=$1`, [id])).rows?.[0];
  return row ? decorate(row, viewerSide) : null;
}

function done(status, certification, audit, extra = {}) {
  return { status, body: { ok: true, certification, ...extra }, audit };
}

async function requestOrCertify(client, ctx, principal, action, input, stamp) {
  const side = ctx.side;
  const taiwanId = ctx.admin ? input.taiwanAgencyId : side === 'taiwan' ? ctx.agencyId : input.counterpartAgencyId;
  const philippinesId = ctx.admin ? input.philippinesAgencyId : side === 'philippines' ? ctx.agencyId : input.counterpartAgencyId;
  if (!validId(taiwanId) || !validId(philippinesId)) return fail(400, ctx.admin ? '請選擇台灣仲介與菲律賓仲介。' : '請選擇要申請認證的對方仲介。');
  const found = (await client.query('SELECT id,name,agency_type FROM hr_agencies WHERE id=ANY($1::bigint[]) AND active=TRUE', [[Number(taiwanId), Number(philippinesId)]])).rows || [];
  const taiwan = found.find(row => Number(row.id) === Number(taiwanId) && row.agency_type === 'taiwan');
  const philippines = found.find(row => Number(row.id) === Number(philippinesId) && row.agency_type === 'philippines');
  if (!taiwan || !philippines) return fail(400, '台灣仲介只能與菲律賓仲介相互認證，且雙方都必須是啟用中的仲介。');
  const memberId = principal?.id || null;
  const base = { taiwan_agency_id: Number(taiwanId), philippines_agency_id: Number(philippinesId), requested_by_member_id: memberId, decided_by_member_id: null };
  const names = `台灣仲介「${taiwan.name}」與菲律賓仲介「${philippines.name}」`;

  const fresh = ctx.admin
    ? { ...base, status: 'certified', requested_by_side: null, taiwan_confirmed_at: stamp, philippines_confirmed_at: stamp, source: 'admin', decided_by_member_id: memberId }
    : { ...base, status: 'pending', requested_by_side: side, taiwan_confirmed_at: side === 'taiwan' ? stamp : null, philippines_confirmed_at: side === 'philippines' ? stamp : null, source: 'request' };
  const insertedId = await insertRow(client, fresh);
  if (insertedId) return done(201, await reload(client, insertedId, side), { action: ctx.admin ? '直接認證' : '申請認證', phrase: `${ctx.admin ? '直接認證了' : '代為申請認證：'}${names}` });

  const existing = (await client.query('SELECT * FROM hr_agency_certifications WHERE taiwan_agency_id=$1 AND philippines_agency_id=$2 FOR UPDATE', [taiwanId, philippinesId])).rows?.[0];
  if (!existing) return fail(409, '認證資料剛剛被其他人更新，請重新整理後再試。');
  if (existing.status === 'certified') return done(200, await reload(client, existing.id, side), null, { already: 'certified' });
  if (ctx.admin) {
    await updateRow(client, { ...existing, status: 'certified', taiwan_confirmed_at: stamp, philippines_confirmed_at: stamp, source: 'admin', decided_by_member_id: memberId });
    return done(200, await reload(client, existing.id, side), { action: '直接認證', phrase: `直接認證了${names}` });
  }
  if (existing.status === 'pending') {
    if (existing.requested_by_side === side) return done(200, await reload(client, existing.id, side), null, { already: 'pending' });
    // 對方早已申請，我方再申請等同同意：雙方都確認，認證完成。
    await updateRow(client, { ...existing, status: 'certified', [STAMP[side]]: stamp, decided_by_member_id: memberId });
    return done(200, await reload(client, existing.id, side), null, { completed: true });
  }
  // rejected／revoked：重新開始一輪申請。
  await updateRow(client, { ...existing, status: 'pending', requested_by_side: side, requested_by_member_id: memberId, decided_by_member_id: null, taiwan_confirmed_at: side === 'taiwan' ? stamp : null, philippines_confirmed_at: side === 'philippines' ? stamp : null, source: 'request' });
  return done(200, await reload(client, existing.id, side), null, { reopened: true });
}

async function decide(client, ctx, principal, action, input, stamp) {
  if (!validId(input.id)) return fail(400, '認證紀錄編號不正確。');
  const row = (await client.query('SELECT * FROM hr_agency_certifications WHERE id=$1 FOR UPDATE', [input.id])).rows?.[0];
  if (!row) return fail(404, '找不到這筆認證紀錄。');
  if (!ctx.admin) {
    const owns = ctx.side === 'taiwan' ? Number(row.taiwan_agency_id) === ctx.agencyId : Number(row.philippines_agency_id) === ctx.agencyId;
    if (!owns) return fail(404, '找不到這筆認證紀錄。'); // 不透露其他機構的紀錄是否存在
  }
  const memberId = principal?.id || null;
  const names = async () => { const full = await reload(client, row.id, null); return `台灣仲介「${full?.taiwan_agency_name}」與菲律賓仲介「${full?.philippines_agency_name}」`; };

  if (action === 'approve') {
    if (row.status !== 'pending') return fail(409, '這筆申請已不在等待確認狀態，請重新整理。');
    if (!ctx.admin && row.requested_by_side === ctx.side) return fail(409, '這筆申請由貴機構提出，需由對方仲介確認。');
    const next = ctx.admin
      ? { ...row, status: 'certified', taiwan_confirmed_at: stamp, philippines_confirmed_at: stamp, source: 'admin', decided_by_member_id: memberId }
      : { ...row, status: 'certified', [STAMP[ctx.side]]: stamp, decided_by_member_id: memberId };
    await updateRow(client, next);
    return done(200, await reload(client, row.id, ctx.side), { action: '同意認證', phrase: `同意並完成了${await names()}的相互認證` });
  }
  if (action === 'reject') {
    if (row.status !== 'pending') return fail(409, '這筆申請已不在等待確認狀態，請重新整理。');
    if (!ctx.admin && row.requested_by_side === ctx.side) return fail(409, '這筆申請由貴機構提出，如要取消請使用「撤回申請」。');
    await updateRow(client, { ...row, status: 'rejected', decided_by_member_id: memberId });
    return done(200, await reload(client, row.id, ctx.side), { action: '拒絕認證', phrase: `拒絕了${await names()}的認證申請` });
  }
  // revoke：解除已完成的認證，或撤回自己提出、尚未被確認的申請。
  const canRevoke = row.status === 'certified' || (row.status === 'pending' && (ctx.admin || row.requested_by_side === ctx.side));
  if (!canRevoke) return fail(409, row.status === 'pending' ? '這筆申請由對方提出，請使用「拒絕」。' : '這筆認證目前不是有效狀態。');
  await updateRow(client, { ...row, status: 'revoked', decided_by_member_id: memberId });
  return done(200, await reload(client, row.id, ctx.side), { action: row.status === 'certified' ? '解除認證' : '撤回申請', phrase: `${row.status === 'certified' ? '解除了' : '撤回了'}${await names()}的認證` });
}

export async function applyCertificationAction(pool, principal, input = {}, now = () => new Date()) {
  const action = String(input?.action || '');
  if (!CERTIFICATION_ACTIONS.includes(action)) return fail(400, '認證操作不正確。');
  const ctx = actorContext(principal);
  if (!ctx) return fail(403, '僅仲介機構或系統管理者可以管理相互認證。');
  if (!ctx.admin && !principal.is_agency_admin) return fail(403, AGENCY_ADMIN_REQUIRED_MESSAGE);
  if (ctx.admin && action === 'request') return fail(403, '系統管理者請使用「直接認證」。');
  if (!ctx.admin && action === 'certify') return fail(403, '只有系統管理者可以直接認證。');
  const stamp = now().toISOString();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = ['request', 'certify'].includes(action)
      ? await requestOrCertify(client, ctx, principal, action, input, stamp)
      : await decide(client, ctx, principal, action, input, stamp);
    await client.query(result.status >= 200 && result.status < 300 ? 'COMMIT' : 'ROLLBACK');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
