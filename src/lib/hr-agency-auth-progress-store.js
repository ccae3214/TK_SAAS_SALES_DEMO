import { AUTH_ITEMS, canTrackProgress, isItemOf, isStageOf, otherSideOf } from './hr-agency-auth-guide.js';
import { AGENCY_ADMIN_REQUIRED_MESSAGE, sideOfAgencyType } from './hr-agency-certification.js';

// 相互認證的「文件驗證進度」：每一筆認證、每一邊、每一份文件各一列，記錄走到哪一關。
// 雙方都看得到對方的進度；只有自己這一邊的仲介管理者（或系統管理者）可以更新自己那一邊。
// 不 import '@/…'，db 只需要有 query(sql, params)，所以 node:test 可以用假的 db 測試。

export async function ensureProgressSchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS hr_agency_cert_progress (
    certification_id BIGINT NOT NULL REFERENCES hr_agency_certifications(id) ON DELETE CASCADE,
    side TEXT NOT NULL CHECK (side IN ('taiwan','philippines')),
    item_key TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'todo',
    note TEXT NOT NULL DEFAULT '',
    updated_by_member_id BIGINT REFERENCES hr_members(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (certification_id, side, item_key)
  )`);
}

const validId = value => /^\d+$/.test(String(value ?? '')) && Number(value) > 0;
const fail = (status, code, error) => ({ status, body: { error, code } });
const rowsOf = result => result?.rows || [];

function actorOf(principal) {
  if (principal?.role === 'admin') return { admin: true };
  if (principal?.role === 'agency' && validId(principal.agency_id)) {
    const side = sideOfAgencyType(principal.agency_type);
    if (side) return { admin: false, side, agencyId: Number(principal.agency_id), manager: !!principal.is_agency_admin };
  }
  return null;
}

async function loadCertification(db, id, actor) {
  const row = rowsOf(await db.query(`SELECT c.id,c.status,c.taiwan_agency_id,c.philippines_agency_id,ta.name AS taiwan_agency_name,pa.name AS philippines_agency_name
    FROM hr_agency_certifications c JOIN hr_agencies ta ON ta.id=c.taiwan_agency_id JOIN hr_agencies pa ON pa.id=c.philippines_agency_id WHERE c.id=$1`, [id]))[0];
  if (!row) return null;
  if (!actor.admin) {
    const own = actor.side === 'taiwan' ? Number(row.taiwan_agency_id) === actor.agencyId : Number(row.philippines_agency_id) === actor.agencyId;
    if (!own) return null; // 不透露其他機構的認證是否存在
  }
  return row;
}

// 讀取一筆認證的進度（雙方都可看）。
export async function readProgress(db, principal, certificationId) {
  const actor = actorOf(principal);
  if (!actor) return fail(403, 'forbidden', '僅仲介機構或系統管理者可以查看認證辦理進度。');
  if (!validId(certificationId)) return fail(400, 'bad_id', '認證紀錄編號不正確。');
  const cert = await loadCertification(db, certificationId, actor);
  if (!cert) return fail(404, 'not_found', '找不到這筆認證紀錄。');
  const rows = rowsOf(await db.query('SELECT side,item_key,stage,note,updated_at FROM hr_agency_cert_progress WHERE certification_id=$1 ORDER BY side,item_key', [cert.id]));
  return {
    status: 200,
    body: {
      certification: { id: Number(cert.id), status: cert.status, taiwan_agency_name: cert.taiwan_agency_name, philippines_agency_name: cert.philippines_agency_name },
      mySide: actor.admin ? null : actor.side,
      canManage: canTrackProgress(cert.status) && (actor.admin || actor.manager),
      rows,
    },
  };
}

// 更新自己這一邊某份文件的進度。系統管理者要指定 side。
export async function saveProgress(db, principal, input = {}) {
  const actor = actorOf(principal);
  if (!actor) return fail(403, 'forbidden', '僅仲介機構或系統管理者可以更新認證辦理進度。');
  if (!actor.admin && !actor.manager) return fail(403, 'manager_required', AGENCY_ADMIN_REQUIRED_MESSAGE);
  if (!validId(input.certificationId)) return fail(400, 'bad_id', '認證紀錄編號不正確。');
  const side = actor.admin ? String(input.side || '') : actor.side;
  const itemKey = String(input.itemKey || '');
  const stage = String(input.stage || '');
  if (!isItemOf(side, itemKey)) return fail(400, 'bad_item', '這份文件不在這一邊的辦理清單中。');
  if (!isStageOf(side, stage)) return fail(400, 'bad_stage', '辦理階段不正確。');
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 300) : '';
  const cert = await loadCertification(db, input.certificationId, actor);
  if (!cert) return fail(404, 'not_found', '找不到這筆認證紀錄。');
  if (!canTrackProgress(cert.status)) return fail(409, 'not_active', '這筆認證已拒絕或解除，不需要再更新辦理進度。');
  await db.query(`INSERT INTO hr_agency_cert_progress(certification_id,side,item_key,stage,note,updated_by_member_id,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,NOW())
    ON CONFLICT(certification_id,side,item_key) DO UPDATE SET stage=EXCLUDED.stage,note=EXCLUDED.note,updated_by_member_id=EXCLUDED.updated_by_member_id,updated_at=NOW()`,
  [cert.id, side, itemKey, stage, note, validId(principal.id) ? principal.id : null]);
  return { status: 200, body: { ok: true, side, item_key: itemKey, stage, note, otherSide: otherSideOf(side), items: AUTH_ITEMS[side] } };
}
