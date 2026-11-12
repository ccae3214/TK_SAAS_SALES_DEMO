// 台灣仲介 ↔ 菲律賓仲介「相互認證」的純邏輯（不連資料庫、不授予權限）。
// 規則：同一組 (台灣仲介, 菲律賓仲介) 必須雙方都確認過（status='certified'），
// 雇主才能挑選該菲律賓仲介的工人、雙方才能互相辦件。

export const CERTIFICATION_STATUSES = ['pending', 'certified', 'rejected', 'revoked'];
export const CERTIFICATION_ACTIONS = ['request', 'approve', 'reject', 'revoke', 'certify'];
export const CERTIFICATION_STATUS_LABELS = {
  pending: '等待對方確認',
  certified: '已相互認證',
  rejected: '已拒絕',
  revoked: '已撤銷',
};
export const CERTIFICATION_SOURCE_LABELS = {
  request: '雙方申請',
  admin: '管理者直接認證',
  grandfathered: '既有合作沿用',
};
// 提出或回應認證是機構層級的決定，預設只開放「仲介管理者」（admin_scope='agency'）與系統管理者。
export const AGENCY_ADMIN_REQUIRED_MESSAGE = '只有仲介管理者可以提出或回應相互認證，請聯絡貴機構的管理者。';

export const sideOfAgencyType = type => (type === 'taiwan' ? 'taiwan' : type === 'philippines' ? 'philippines' : null);
export const otherSide = side => (side === 'taiwan' ? 'philippines' : side === 'philippines' ? 'taiwan' : null);

// 兩邊都確認才算認證完成；光看 status 不夠，避免資料被誤改成 certified。
export function isCertified(row) {
  return !!row && row.status === 'certified' && !!row.taiwan_confirmed_at && !!row.philippines_confirmed_at;
}

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

export function isPairCertified(rows = [], taiwanAgencyId, philippinesAgencyId) {
  return rows.some(row => isCertified(row) && sameId(row.taiwan_agency_id, taiwanAgencyId) && sameId(row.philippines_agency_id, philippinesAgencyId));
}

// 回傳某機構「已相互認證」的對方機構編號集合。
export function certifiedPartnerIds(rows = [], side, agencyId) {
  const mine = side === 'taiwan' ? 'taiwan_agency_id' : 'philippines_agency_id';
  const theirs = side === 'taiwan' ? 'philippines_agency_id' : 'taiwan_agency_id';
  if (!otherSide(side)) return new Set();
  return new Set(rows.filter(row => isCertified(row) && sameId(row[mine], agencyId)).map(row => Number(row[theirs])));
}

// 雇主（隸屬某台灣仲介）可挑選的工作者：必須屬於已與該台灣仲介相互認證的菲律賓仲介。
export function filterWorkersByCertification(workers = [], rows = [], taiwanAgencyId) {
  const partners = certifiedPartnerIds(rows, 'taiwan', taiwanAgencyId);
  return workers.filter(worker => worker.agency_id != null && partners.has(Number(worker.agency_id)));
}

// 目前這一邊（viewerSide）對這筆關係可以做的動作。row 為 null 代表尚未有任何紀錄。
export function availableActions(row, viewerSide) {
  if (!otherSide(viewerSide)) return [];
  if (!row || row.status === 'rejected' || row.status === 'revoked') return ['request'];
  if (row.status === 'certified') return ['revoke'];
  if (row.status === 'pending') return row.requested_by_side === viewerSide ? ['revoke'] : ['approve', 'reject'];
  return [];
}

// 等待哪一邊回應（只有 pending 才有）。
export function awaitingSide(row) {
  return row?.status === 'pending' ? otherSide(row.requested_by_side) : null;
}

export function actionLabel(action, row) {
  if (action === 'request') return row ? '重新申請認證' : '申請認證';
  if (action === 'approve') return '同意認證';
  if (action === 'reject') return '拒絕';
  if (action === 'certify') return '直接認證';
  if (action === 'revoke') return row?.status === 'pending' ? '撤回申請' : '解除認證';
  return action;
}

// SQL 片段：給後端查詢使用，避免各處各寫一份條件而不一致。
export const certifiedPairSql = (taiwanColumn, philippinesColumn, alias = 'ac') =>
  `EXISTS(SELECT 1 FROM hr_agency_certifications ${alias} WHERE ${alias}.taiwan_agency_id=${taiwanColumn} AND ${alias}.philippines_agency_id=${philippinesColumn} AND ${alias}.status='certified')`;
