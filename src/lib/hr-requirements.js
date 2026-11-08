// 工作者必要文件清單，以及「依履歷判斷哪些條件式文件適用」的規則。
// 純函式（不碰資料庫），方便單獨測試；資料庫相關的小工具放在檔案後半段。

// [文件名稱, 適用條件說明（空字串 = 一律適用）]
export const WORKER_DOCUMENTS = [
  ['新護照', ''], ['舊護照', ''], ['ARC', '曾在台灣工作者'],
  ['國民身分證（EgovPH下載）', ''], ['PSA出生證明（附收據）', ''],
  ['PSA結婚證明（附收據）', '已婚者'], ['子女PSA出生證明（附收據）', '有子女者'],
  ['PSA CENOMAR', '未婚者'], ['CAV／NC2 TESDA', ''], ['NBI（確認有效期限）', ''],
  ['E-registration（建立線上資料）', ''], ['PEOS', ''], ['照片（2x2 16張及護照尺寸2張）', ''],
  ['Voter ID／Voter Certificate', ''], ['SSS contribution', ''], ['體檢 Medical', ''],
  ['LCR Form 1-A', ''], ['DMW Info Sheet', '曾在海外工作者'],
  ['Health Card', '曾在台灣工作者'], ['BOI旅行紀錄（單身及已婚）', ''],
  ['出生逾10年補登證明（洗禮證明；未受洗提供學校紀錄）', '出生登記逾10年補登者'], ['TIN ID', ''],
];

export const WORKER_DOCUMENT_NAMES = WORKER_DOCUMENTS.map(([name]) => name);

// 前置文件：核准前不能排體檢、訓練。體檢本身（「體檢 Medical」）絕不能放這裡，否則會互相卡死。
export const ENTRY_GATE_DOCUMENTS = ['新護照', 'PSA出生證明（附收據）'];
const ENTRY_GATE_SET = new Set(ENTRY_GATE_DOCUMENTS);

const text = value => String(value ?? '').trim();
const isYes = value => /^(是|yes|y|true)$/i.test(text(value));
const TAIWAN_PATTERN = /taiwan|taipei|taoyuan|taichung|tainan|kaohsiung|hsinchu|台灣|臺灣|台北|臺北|桃園|台中|臺中|台南|臺南|高雄|新竹/i;

function overseasRows(profile) {
  return Array.isArray(profile.overseasExperiences)
    ? profile.overseasExperiences.filter(row => row && typeof row === 'object'
        && [row.workplace, row.period, row.title, row.content].some(field => text(field)))
    : [];
}

// 依履歷判斷 6 項可推導的條件式文件是否適用。
// 資料不足（欄位空白、選了「有伴侶」）時一律回傳 false，維持原本「預設不適用，由仲介覆核」的行為。
// 「出生逾10年補登證明」無法從履歷推導，永遠由仲介手動確認。
export function deriveApplicability(resumeProfile) {
  const profile = resumeProfile && typeof resumeProfile === 'object' && !Array.isArray(resumeProfile) ? resumeProfile : {};
  const marital = text(profile.maritalStatus);
  const childCount = Number.parseInt(text(profile.numberOfChildren), 10);
  const hasChildren = Number.isFinite(childCount) ? childCount > 0 : Boolean(text(profile.childrenAges));
  const rows = overseasRows(profile);
  const legacyDetails = text(profile.overseasWorkDetails);
  const taiwanText = [...rows.flatMap(row => [row.workplace, row.period, row.title, row.content]), legacyDetails].map(text).join(' ');
  const workedInTaiwan = TAIWAN_PATTERN.test(taiwanText);
  const workedAbroad = workedInTaiwan || isYes(profile.workedAbroad) || rows.length > 0 || Boolean(legacyDetails);
  return {
    'ARC': workedInTaiwan,
    'Health Card': workedInTaiwan,
    'DMW Info Sheet': workedAbroad,
    'PSA結婚證明（附收據）': /已結婚|married/i.test(marital),
    '子女PSA出生證明（附收據）': hasChildren,
    'PSA CENOMAR': /單身|未婚|single/i.test(marital),
    '出生逾10年補登證明（洗禮證明；未受洗提供學校紀錄）': false,
  };
}

// 建案時用：回傳 22 項文件各自的「是否適用」與「是否為前置文件」。
export function buildRequirementRows(resumeProfile) {
  const derived = deriveApplicability(resumeProfile);
  return WORKER_DOCUMENTS.map(([name, applicability]) => {
    const applicable = applicability ? derived[name] === true : true;
    return { name, applicability, applicable, entryGate: applicable && ENTRY_GATE_SET.has(name) };
  });
}

// ---- 案件專屬要求（證照）規則 ----
// 文件（護照、PSA…）屬於工人，與案件無關；案件只會因為職類多出「必備證照」，
// 例如看護案件需要 Caregiving NC2。工人還沒有證照時，用取證進度追蹤。
export const CASE_CERTIFICATION_RULES = {
  '家庭看護': ['Caregiving NC2'],
  '機構看護工': ['Caregiving NC2'],
};

// 取證進度：未開始 → 訓練中 → 考照中 → 已取得
export const CERTIFICATION_STATUSES = ['not_started', 'training', 'assessment', 'obtained'];

export function certificationNamesForJobType(jobType) {
  return CASE_CERTIFICATION_RULES[text(jobType)] || [];
}

// ---- 資料庫小工具（runner 可以是 pool 或 transaction 的 client，只要有 .query）----

// 工人建立時就建立完整文件清單；適用性依履歷預設。已存在的文件不會被動到。
export async function insertWorkerDocuments(runner, workerId, resumeProfile) {
  const rows = buildRequirementRows(resumeProfile);
  await runner.query(`INSERT INTO hr_worker_documents(worker_id,name,required,entry_gate,applicability,applicable,applicability_source)
    VALUES ${rows.map((_, index) => `($1,$${index * 4 + 2},TRUE,$${index * 4 + 5}::boolean,$${index * 4 + 3},$${index * 4 + 4}::boolean,'auto')`).join(',')}
    ON CONFLICT(worker_id,name) DO NOTHING`,
  [workerId, ...rows.flatMap(row => [row.name, row.applicability, row.applicable, row.entryGate])]);
}

// 替「還缺文件列」的工人補齊清單（舊資料、之後新增的文件種類、漏掉的建立入口都靠這個補）。
export async function backfillWorkerDocuments(runner) {
  const missing = await runner.query(`SELECT w.id,w.resume_profile FROM hr_workers w
    WHERE (SELECT count(*) FROM hr_worker_documents d WHERE d.worker_id=w.id AND d.name=ANY($1::text[]))<$2`,
  [WORKER_DOCUMENT_NAMES, WORKER_DOCUMENT_NAMES.length]);
  for (const row of missing.rows) await insertWorkerDocuments(runner, row.id, row.resume_profile);
  return missing.rows.length;
}

// 履歷更新後，重新套用「仍是自動判斷、且尚未收件」的文件適用性。
// 仲介手動調整過（applicability_source='manual'）或已經有人上傳／審核的文件不會被動到。
// 回傳是否有任何文件變動，呼叫端再重算該工人所有案件的階段。
export async function syncWorkerDocuments(runner, workerId) {
  const worker = await runner.query('SELECT resume_profile FROM hr_workers WHERE id=$1', [workerId]);
  if (!worker.rows.length) return false;
  const derived = deriveApplicability(worker.rows[0].resume_profile);
  let changed = false;
  for (const [name, applicability] of WORKER_DOCUMENTS) {
    if (!applicability) continue;
    const result = await runner.query(`UPDATE hr_worker_documents SET applicable=$3,updated_at=NOW()
      WHERE worker_id=$1 AND name=$2 AND applicability_source='auto' AND status='missing'
        AND applicable IS DISTINCT FROM $3::boolean RETURNING id`, [workerId, name, derived[name] === true]);
    if (result.rows.length) changed = true;
  }
  return changed;
}

// 建案時依職類建立必備證照列。
export async function insertCaseCertifications(runner, caseId, jobType) {
  for (const name of certificationNamesForJobType(jobType)) {
    await runner.query(`INSERT INTO hr_case_certifications(case_id,name) VALUES($1,$2) ON CONFLICT(case_id,name) DO NOTHING`, [caseId, name]);
  }
}

// 補齊既有案件缺少的證照列。
export async function backfillCaseCertifications(runner) {
  const cases = await runner.query("SELECT id,job_type FROM hr_cases WHERE job_type=ANY($1::text[])", [Object.keys(CASE_CERTIFICATION_RULES)]);
  for (const row of cases.rows) await insertCaseCertifications(runner, row.id, row.job_type);
}
