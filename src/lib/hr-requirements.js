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

// ---- 資料庫小工具（runner 可以是 pool 或 transaction 的 client，只要有 .query）----

export async function insertCaseRequirements(runner, caseId, resumeProfile) {
  const rows = buildRequirementRows(resumeProfile);
  await runner.query(`INSERT INTO hr_case_requirements(case_id,name,required,entry_gate,applicability,applicable,applicability_source)
    VALUES ${rows.map((_, index) => `($1,$${index * 4 + 2},TRUE,$${index * 4 + 5}::boolean,$${index * 4 + 3},$${index * 4 + 4}::boolean,'auto')`).join(',')}
    ON CONFLICT(case_id,name) DO NOTHING`,
  [caseId, ...rows.flatMap(row => [row.name, row.applicability, row.applicable, row.entryGate])]);
}

// 履歷更新後，重新套用到「仍是自動判斷、且尚未收件」的文件。
// 仲介手動調整過（applicability_source='manual'）或已經有人上傳／審核的文件不會被動到。
// 回傳有變動的案件編號，呼叫端再去 refreshCaseStage。
export async function syncAutoRequirements(runner, workerId) {
  const worker = await runner.query('SELECT resume_profile FROM hr_workers WHERE id=$1', [workerId]);
  if (!worker.rows.length) return [];
  const cases = await runner.query("SELECT id FROM hr_cases WHERE worker_id=$1 AND status<>'closed'", [workerId]);
  if (!cases.rows.length) return [];
  const caseIds = cases.rows.map(row => Number(row.id));
  const derived = deriveApplicability(worker.rows[0].resume_profile);
  const changed = new Set();
  for (const [name, applicability] of WORKER_DOCUMENTS) {
    if (!applicability) continue;
    const result = await runner.query(`UPDATE hr_case_requirements SET applicable=$3,updated_at=NOW()
      WHERE case_id=ANY($1::bigint[]) AND name=$2 AND applicability_source='auto' AND status='missing'
        AND applicable IS DISTINCT FROM $3::boolean RETURNING case_id`, [caseIds, name, derived[name] === true]);
    result.rows.forEach(row => changed.add(Number(row.case_id)));
  }
  return [...changed];
}
