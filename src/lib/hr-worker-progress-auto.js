// 工作者「進度安排」的自動帶入（純函式，不碰資料庫，前後端與 node:test 都能用）。
//
// 規則：只在「沒有手動記錄日期」時，才用系統內已經有的資料帶入；手動儲存過的日期永遠優先。
// 帶入的值不會寫進資料庫，所以來源資料變動（例如文件被核准、報名班別）時，下次開啟頁面就會跟著更新；
// 在畫面上按「儲存」才會變成手動記錄。
//
//   match_date                 ← 這位工作者最早的案件建立日期（配工）
//   employer_approval_received ← 雇主核准函最近一次上傳日期
//   passport                   ← 「新護照」文件核准日期
//   personal_documents         ← 全部必要文件核准的日期（取最晚一份的核准日期）
//   training                   ← 報名班別的訓練開始日／最晚結訓日（結訓日已過才帶入完成日）
import { taipeiToday } from './hr-training-auto-status.js';

export const AUTO_SOURCE_LABELS = {
  case_created: '依案件建立日期自動帶入',
  approval_letter: '依核准函上傳日期自動帶入',
  passport_approved: '依護照文件核准日期自動帶入',
  documents_approved: '依必要文件全數核准的日期自動帶入',
  training_classes: '依報名班別的訓練日期自動帶入',
};

const PASSPORT_DOCUMENT = '新護照';

// 任何可轉成日期的值 → 台灣時間的 YYYY-MM-DD；無法判斷就回傳 ''。
export function toTaipeiDate(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? taipeiToday(date) : '';
}

const earliest = list => list.filter(Boolean).sort()[0] || '';
const latest = list => list.filter(Boolean).sort().at(-1) || '';

// documents: [{ name, required, applicable, status, approved_at }]（approved_at：最近一次核准時間）
// caseCreatedAt / approvalLetterUploadedAt: 時間或日期的陣列
// classes: [{ start, end }]（YYYY-MM-DD）
// 回傳 { [stepKey]: { started_on, completed_on, source } }
export function deriveAutoSteps({ documents = [], caseCreatedAt = [], approvalLetterUploadedAt = [], classes = [], today = taipeiToday() } = {}) {
  const result = {};

  const matchDate = earliest(caseCreatedAt.map(toTaipeiDate));
  if (matchDate) result.match_date = { started_on: '', completed_on: matchDate, source: 'case_created' };

  const letterDate = latest(approvalLetterUploadedAt.map(toTaipeiDate));
  if (letterDate) result.employer_approval_received = { started_on: '', completed_on: letterDate, source: 'approval_letter' };

  const passport = documents.find(doc => doc.name === PASSPORT_DOCUMENT && doc.applicable && doc.status === 'approved');
  const passportDate = toTaipeiDate(passport?.approved_at);
  if (passportDate) result.passport = { started_on: '', completed_on: passportDate, source: 'passport_approved' };

  const required = documents.filter(doc => doc.required && doc.applicable);
  if (required.length > 0 && required.every(doc => doc.status === 'approved')) {
    const date = latest(required.map(doc => toTaipeiDate(doc.approved_at)));
    if (date) result.personal_documents = { started_on: '', completed_on: date, source: 'documents_approved' };
  }

  const starts = classes.map(item => toTaipeiDate(item.start));
  const ends = classes.map(item => toTaipeiDate(item.end));
  if (starts.some(Boolean)) {
    const lastEnd = ends.every(Boolean) ? latest(ends) : '';
    result.training = { started_on: earliest(starts), completed_on: lastEnd && lastEnd < today ? lastEnd : '', source: 'training_classes' };
  }

  return result;
}

// 把自動帶入的值套到一個進度項目上：已有手動日期就維持原樣，否則補上自動帶入的日期。
export function applyAutoStep(step, auto) {
  if (!auto || step.started_on || step.completed_on) return { ...step, auto_source: null };
  return { ...step, started_on: auto.started_on || '', completed_on: auto.completed_on || '', auto_source: auto.source };
}
