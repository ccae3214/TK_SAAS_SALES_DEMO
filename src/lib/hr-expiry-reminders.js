// 到期提醒的規則與訊息（純函式，不碰資料庫，方便單獨測試）。
//
//   體檢：記錄「體檢過期日」，過期日前 10 天開始提醒工人與仲介。
//   合約（雇主的核准函）：記錄「發函日」，有效期 9 個月，到期前 20 天開始提醒。
//   工人實際入境後，這兩項都不再提醒。

export const MEDICAL_REMINDER_DAYS = 10;
export const CONTRACT_REMINDER_DAYS = 20;
export const CONTRACT_VALID_MONTHS = 9;

export const REMINDER_KINDS = ['medical', 'contract'];
export const REMINDER_LABELS = {
  medical: { upcoming: '體檢即將過期', overdue: '體檢已過期' },
  contract: { upcoming: '核准函（合約）即將到期', overdue: '核准函（合約）已到期' },
};

const pad = value => String(value).padStart(2, '0');

// 'YYYY-MM-DD' → { year, month, day }；格式或日期不正確回傳 null。
export function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? { year, month, day } : null;
}

// 加月份；日期超過當月天數時取當月最後一天（例如 5/31 加 9 個月 → 2/28 或 2/29）。
export function addMonthsIso(value, months) {
  const parsed = parseIsoDate(value);
  if (!parsed) return null;
  const total = parsed.month - 1 + months;
  const year = parsed.year + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = Math.min(parsed.day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

// 從 todayIso 到 targetIso 還有幾天（過了就是負數）。
export function daysUntil(todayIso, targetIso) {
  const from = parseIsoDate(todayIso), to = parseIsoDate(targetIso);
  if (!from || !to) return null;
  return Math.round((Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / 86400000);
}

// 台灣日期（伺服器可能是 UTC，提醒以台灣的日期計算）。
export function taipeiToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// 一位工人目前該提醒的項目。input: { medicalExpiryOn, contractIssuedOn, arrived }，日期為 'YYYY-MM-DD'。
export function buildExpiryReminders({ medicalExpiryOn, contractIssuedOn, arrived }, todayIso) {
  if (arrived) return [];
  const reminders = [];
  const medicalLeft = daysUntil(todayIso, medicalExpiryOn);
  if (medicalLeft !== null && medicalLeft <= MEDICAL_REMINDER_DAYS) {
    reminders.push({ kind: 'medical', dueOn: medicalExpiryOn, daysLeft: medicalLeft, overdue: medicalLeft < 0 });
  }
  const contractDue = addMonthsIso(contractIssuedOn, CONTRACT_VALID_MONTHS);
  const contractLeft = contractDue ? daysUntil(todayIso, contractDue) : null;
  if (contractLeft !== null && contractLeft <= CONTRACT_REMINDER_DAYS) {
    reminders.push({ kind: 'contract', dueOn: contractDue, daysLeft: contractLeft, overdue: contractLeft < 0 });
  }
  return reminders;
}

// LINE 推播訊息（繁體中文、英文、Filipino）。
export function expiryMessage(language, { workerName, kind, dueOn, daysLeft, overdue }) {
  const days = Math.abs(daysLeft);
  const copy = {
    zh: {
      medical: overdue ? `⏰ 體檢已過期\n${workerName} 的體檢已於 ${dueOn} 過期（逾期 ${days} 天）。請盡快安排重新體檢。`
        : `⏰ 體檢即將過期\n${workerName} 的體檢將於 ${dueOn} 過期（${daysLeft === 0 ? '今天' : `剩 ${daysLeft} 天`}）。請提早安排重新體檢。`,
      contract: overdue ? `⏰ 核准函（合約）已到期\n${workerName} 的核准函（合約）已於 ${dueOn} 到期（逾期 ${days} 天）。請盡快處理。`
        : `⏰ 核准函（合約）即將到期\n${workerName} 的核准函（合約）將於 ${dueOn} 到期（${daysLeft === 0 ? '今天' : `剩 ${daysLeft} 天`}）。請盡快處理。`,
    },
    en: {
      medical: overdue ? `⏰ Medical exam expired\n${workerName}'s medical exam expired on ${dueOn} (${days} day${days === 1 ? '' : 's'} ago). Please arrange a new exam as soon as possible.`
        : `⏰ Medical exam expiring soon\n${workerName}'s medical exam expires on ${dueOn} (${daysLeft === 0 ? 'today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}). Please arrange a new exam in time.`,
      contract: overdue ? `⏰ Approval letter (contract) expired\n${workerName}'s approval letter (contract) expired on ${dueOn} (${days} day${days === 1 ? '' : 's'} ago). Please follow up right away.`
        : `⏰ Approval letter (contract) expiring soon\n${workerName}'s approval letter (contract) expires on ${dueOn} (${daysLeft === 0 ? 'today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}). Please follow up right away.`,
    },
    tl: {
      medical: overdue ? `⏰ Nag-expire na ang medical exam\nNag-expire noong ${dueOn} ang medical exam ni ${workerName} (${days} araw na ang nakalipas). Mag-ayos agad ng bagong exam.`
        : `⏰ Malapit nang mag-expire ang medical exam\nMag-e-expire sa ${dueOn} ang medical exam ni ${workerName} (${daysLeft === 0 ? 'ngayong araw' : `${daysLeft} araw na lang`}). Mag-ayos ng bagong exam nang maaga.`,
      contract: overdue ? `⏰ Nag-expire na ang approval letter (kontrata)\nNag-expire noong ${dueOn} ang approval letter (kontrata) ni ${workerName} (${days} araw na ang nakalipas). Asikasuhin agad.`
        : `⏰ Malapit nang mag-expire ang approval letter (kontrata)\nMag-e-expire sa ${dueOn} ang approval letter (kontrata) ni ${workerName} (${daysLeft === 0 ? 'ngayong araw' : `${daysLeft} araw na lang`}). Asikasuhin agad.`,
    },
  };
  return (copy[language] || copy.zh)[kind];
}
