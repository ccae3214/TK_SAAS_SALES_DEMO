// 操作紀錄的「改之前 / 改之後」資料。
// 測試階段常有身分填錯、資料改錯；以前紀錄只有一句摘要，看不到原本的值，改錯了沒辦法照著還原。
// 現在操作前後各拍一次快照，只把「有變動的欄位」存進 before_data / after_data（JSONB）。
// - 編輯：只存變動的欄位；JSONB 欄位（履歷、雇主補充資料）再往下比一層，只存變動的子欄位。
// - 刪除：after 為 null，before 存完整資料（永久刪除後這是唯一留下的副本）。
// - 新增：before 為 null，after 存完整資料。
// 純函式＋查詢用的 SQL，不依賴 '@/' 路徑，方便單獨測試。

// 不記錄的欄位：時間戳記（每次都會變）、密碼、LINE ID、照片等不該出現在紀錄裡的資料。
const IGNORED = new Set(['created_at', 'updated_at', 'password_hash', 'line_user_id', 'photoDataUrl', 'onboarding_seen', 'welcomed_at']);
const MAX_STRING = 600;
const MAX_JSON = 30000;

// 操作類型 → 快照查詢。只列出「人與機構」這類改錯會造成困擾的資料。
// is_test（測試資料標記）用 to_jsonb 讀取：欄位還沒建立的環境也能查詢（值為 NULL）。
const SNAPSHOT_SQL = {
  worker: `SELECT id,name,nationality,phone,email,job_preference,notes,status,agency_id,resume_profile-'photoDataUrl' AS resume_profile,
      (to_jsonb(hr_workers)->>'is_test')::boolean AS is_test
    FROM hr_workers WHERE id=$1`,
  employer: `SELECT id,name,contact_name,phone,email,address,notes,status,agency_id,employer_type,employer_profile,
      (to_jsonb(hr_employers)->>'is_test')::boolean AS is_test
    FROM hr_employers WHERE id=$1`,
  agency: "SELECT id,name,agency_type,country,active,(to_jsonb(hr_agencies)->>'is_test')::boolean AS is_test FROM hr_agencies WHERE id=$1",
  member: `SELECT id,email,display_name,role,admin_scope,active,deleted_at,requested_role,requested_agency_id,
      worker_id,employer_id,agency_id,training_center_id,last_worker_id,last_employer_id,(to_jsonb(hr_members)->>'is_test')::boolean AS is_test
    FROM hr_members WHERE id=$1`,
  case: `SELECT id,case_number,employer_id,worker_id,assigned_member_id,job_type,stage,status,expected_start_date,notes,medical_status,training_status
    FROM hr_cases WHERE id=$1`,
};

const TYPE_TO_SNAPSHOT = {
  worker: 'worker', 'worker-resume': 'worker',
  employer: 'employer',
  agency: 'agency',
  member: 'member', 'member-profile': 'member', 'member-admin-scope': 'member', 'member-restore': 'member',
  case: 'case',
};

export const snapshotKindOf = type => TYPE_TO_SNAPSHOT[type] || null;

// run(sql, params) → rows。查不到或發生錯誤都回傳 null（紀錄失敗不能影響原本的操作）。
export async function takeSnapshot(run, type, id) {
  const kind = snapshotKindOf(type);
  if (!kind || !id) return null;
  try {
    const rows = await run(SNAPSHOT_SQL[kind], [id]);
    return rows?.[0] ? normalize(rows[0]) : null;
  } catch { return null; }
}

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

function normalize(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (IGNORED.has(key)) continue;
    if (value instanceof Date) out[key] = value.toISOString();
    else if (typeof value === 'bigint') out[key] = Number(value);
    else if (isPlainObject(value)) out[key] = Object.fromEntries(Object.entries(value).filter(([k]) => !IGNORED.has(k)));
    else out[key] = value;
  }
  return out;
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// 回傳 { before, after }，只含有變動的欄位；完全沒變動時兩者都是 null。
export function diffSnapshots(before, after) {
  if (!before && !after) return { before: null, after: null };
  if (!before) return { before: null, after: limitSize(after) };
  if (!after) return { before: limitSize(before), after: null };
  const changedBefore = {}, changedAfter = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key], b = after[key];
    if (same(a, b)) continue;
    if (isPlainObject(a) && isPlainObject(b)) {
      const subBefore = {}, subAfter = {};
      for (const sub of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (same(a[sub], b[sub])) continue;
        subBefore[sub] = a[sub] ?? null;
        subAfter[sub] = b[sub] ?? null;
      }
      changedBefore[key] = subBefore;
      changedAfter[key] = subAfter;
    } else {
      changedBefore[key] = a ?? null;
      changedAfter[key] = b ?? null;
    }
  }
  if (!Object.keys(changedAfter).length) return { before: null, after: null };
  return { before: limitSize(changedBefore), after: limitSize(changedAfter) };
}

// 避免單筆紀錄過大：太長的文字截斷；整份仍然太大就再縮短。
function clip(value, max) {
  if (typeof value === 'string') return value.length > max ? `${value.slice(0, max)}…` : value;
  if (Array.isArray(value)) return value.map(item => clip(item, max));
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clip(v, max)]));
  return value;
}

export function limitSize(value) {
  if (value === null || value === undefined) return null;
  let max = MAX_STRING;
  let out = clip(value, max);
  while (JSON.stringify(out).length > MAX_JSON && max > 20) { max = Math.floor(max / 2); out = clip(value, max); }
  return out;
}

// 給畫面用：把 before/after 攤平成「欄位、改前、改後」的列表。
export function changeRows(before, after) {
  const rows = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of keys) {
    const a = before?.[key], b = after?.[key];
    if (isPlainObject(a) || isPlainObject(b)) {
      for (const sub of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) rows.push({ field: `${key}.${sub}`, before: a?.[sub] ?? null, after: b?.[sub] ?? null });
    } else rows.push({ field: key, before: a ?? null, after: b ?? null });
  }
  return rows;
}
