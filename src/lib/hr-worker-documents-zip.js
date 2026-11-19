// 「已核准文件打包下載」的權限與檔名規則（純函式，不碰資料庫，方便單獨測試）。
// 規則沿用單份文件下載（/api/hr/documents/[submissionId]）：系統管理者、所屬菲律賓仲介、
// 雇主與雇主所屬的台灣仲介；差別是打包下載只開放給「已配對到雇主（已建案）」的工作者。

export const MAX_ZIP_SOURCE_BYTES = 150 * 1024 * 1024;

// 回傳 null 代表可以下載；否則回傳 { status, message }。
// worker: { agency_id }；cases: [{ employer_id, employer_agency_id }]（這位工作者所有案件）。
export function workerDocumentsAccessError(principal, worker, cases) {
  if (!principal || !principal.role) return { status: 403, message: 'HR membership required' };
  if (principal.role === 'admin') return null;
  if (principal.role !== 'employer' && principal.role !== 'agency') return { status: 403, message: '此帳號無權下載這位工作者的文件。' };
  const matched = Array.isArray(cases) ? cases : [];
  const related = principal.role === 'employer'
    ? matched.some(item => Number(item.employer_id) === Number(principal.employer_id))
    : Number(principal.agency_id) === Number(worker?.agency_id) || matched.some(item => Number(item.employer_agency_id) === Number(principal.agency_id));
  if (!related) return { status: 403, message: '此帳號無權下載這位工作者的文件。' };
  if (!matched.length) return { status: 409, message: '這位工作者尚未配對到雇主，無法打包下載文件。' };
  return null;
}

const UNSAFE_NAME = /[\\/:*?"<>|\x00-\x1f]/g;
export const safeFileName = (value, fallback = 'file', max = 80) => {
  const text = String(value ?? '').replace(UNSAFE_NAME, '_').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, max).trim();
  return text || fallback;
};

const EXTENSIONS = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg' };

// 例如 "03_PSA出生證明（附收據）.pdf"；前面的序號讓檔案依文件順序排列，也避免同名衝突。
export function documentEntryName(index, requirementName, contentType) {
  return `${String(index + 1).padStart(2, '0')}_${safeFileName(requirementName, 'document')}${EXTENSIONS[String(contentType || '').toLowerCase()] || ''}`;
}

// 放在 ZIP 內的文件清單（中英文標題），方便入境時逐項核對。
export function documentsManifest(workerName, items, generatedAt = new Date()) {
  const lines = [
    `Approved documents / 已審核通過文件`,
    `Worker / 工作者: ${workerName}`,
    `Generated / 產生時間: ${generatedAt.toISOString()}`,
    '',
    'File / 檔名\tDocument / 文件\tVersion / 版本\tOriginal file / 原始檔名\tSHA-256',
    ...items.map(item => [item.entryName, item.name, item.version, item.originalFilename, item.sha256].join('\t')),
    '',
  ];
  return lines.join('\r\n');
}
