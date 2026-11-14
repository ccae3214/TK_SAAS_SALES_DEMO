// 台灣仲介 ↔ 菲律賓仲介 相互認證時，雙方各自要把文件拿去對方國家的駐外代表處驗證。
// 這個檔案放「辦理路線、每一關的規費與時間、要準備的文件清單」與進度計算，全部是純函式（不 import '@/…'），方便 node:test 測試。
//
// 費用與時間是 2026-11-14 從公開網頁整理的參考值，會變動，畫面上都標示「以各機關最新公告為準」。
// 查不到官方數字的項目（公證費、菲律賓 DFA 驗證費）故意不估算，只標示「依公告」，避免給錯數字。

export const AUTH_GUIDE_CHECKED_ON = '2026-11-14';

// 文件由哪一邊的機構「簽發」就由哪一邊辦理驗證，驗證完成後交給對方：
//  taiwan      台灣仲介的文件（在台灣簽發、要在菲律賓使用）：法院／民間公證 → 外交部領事事務局驗證 → 菲律賓馬尼拉經濟文化辦事處（MECO）驗證
//  philippines 菲律賓仲介的文件（在菲律賓簽發、要在台灣使用）：菲律賓外交部（DFA）驗證 → 駐菲律賓臺北經濟文化辦事處（TECO）驗證
export const AUTH_ROUTES = {
  taiwan: {
    stages: ['todo', 'notarized', 'boca', 'meco', 'delivered'],
    legs: [
      { key: 'boca', currency: 'TWD', fee: { normal: [400, 400], expedited: [600, 600] }, days: { normal: [2, 2], expedited: [1, 1] }, estimated: false },
      // MECO 官方收費沒有查到，這裡用代辦業者公開報價（每份約 NT$1,000，急件加 NT$200，約 3 個工作天）當參考。
      { key: 'meco', currency: 'TWD', fee: { normal: [1000, 1000], expedited: [1200, 1200] }, days: { normal: [3, 3], expedited: [1, 1] }, estimated: true },
    ],
    excluded: ['notary'],
  },
  philippines: {
    stages: ['todo', 'dfa', 'teco', 'delivered'],
    legs: [
      // 駐菲律賓臺北經濟文化辦事處公告：一般件約 6–8 個工作天、每件 PHP 800–900；速件 2–3 個工作天、每件加收 PHP 400–450（不同頁面數字略有出入，所以給範圍）。
      { key: 'teco', currency: 'PHP', fee: { normal: [800, 900], expedited: [1200, 1350] }, days: { normal: [6, 8], expedited: [2, 3] }, estimated: false },
    ],
    excluded: ['dfa'],
  },
};

// 每一邊建議準備的文件。RA／SPA 是菲律賓 DMW 認可外國雇主／仲介時要求的「經驗證的招聘協議書與授權書」，所以由台灣這一邊辦理。
// 其餘項目是常見的身分／資格證明，實際要求請以雙方與主管機關為準，所以畫面標示為「建議」。
export const AUTH_ITEMS = {
  taiwan: ['business_registration', 'agency_license', 'recruitment_agreement', 'spa'],
  philippines: ['dmw_license', 'company_registration'],
};

export const SIDES = ['taiwan', 'philippines'];
export const isSide = value => SIDES.includes(value);
export const isItemOf = (side, item) => isSide(side) && AUTH_ITEMS[side].includes(item);
export const isStageOf = (side, stage) => isSide(side) && AUTH_ROUTES[side].stages.includes(stage);
export const otherSideOf = side => (side === 'taiwan' ? 'philippines' : 'taiwan');

// 單一文件的進度：0 ~ 1（階段位置 / 最後階段位置）。
export function itemFraction(side, stage) {
  if (!isStageOf(side, stage)) return 0;
  const stages = AUTH_ROUTES[side].stages;
  return stages.indexOf(stage) / (stages.length - 1);
}

// rows：該認證、該邊的進度資料 [{ item_key, stage }]。沒有資料的項目視為「尚未辦理」。
export function progressOf(side, rows = []) {
  if (!isSide(side)) return { done: 0, total: 0, percent: 0 };
  const items = AUTH_ITEMS[side];
  const stageOf = Object.fromEntries((rows || []).map(row => [row.item_key, row.stage]));
  const total = items.length;
  const done = items.filter(item => stageOf[item] === 'delivered').length;
  const sum = items.reduce((acc, item) => acc + itemFraction(side, stageOf[item] || 'todo'), 0);
  return { done, total, percent: total ? Math.round((sum / total) * 100) : 0 };
}

// 預估規費與時間（不含公證費、DFA 驗證費、郵寄與等待排程）。documents = 要驗證的份數。
export function estimateAuthentication(side, { documents = 1, expedited = false } = {}) {
  if (!isSide(side)) return null;
  const count = Math.max(1, Math.floor(Number(documents) || 1));
  const mode = expedited ? 'expedited' : 'normal';
  const route = AUTH_ROUTES[side];
  const fees = new Map();
  let minDays = 0, maxDays = 0, estimated = false;
  for (const leg of route.legs) {
    const [feeMin, feeMax] = leg.fee[mode];
    const total = fees.get(leg.currency) || { currency: leg.currency, min: 0, max: 0 };
    total.min += feeMin * count; total.max += feeMax * count;
    fees.set(leg.currency, total);
    minDays += leg.days[mode][0]; maxDays += leg.days[mode][1];
    if (leg.estimated) estimated = true;
  }
  return { documents: count, expedited: !!expedited, fees: [...fees.values()], days: { min: minDays, max: maxDays }, estimated, excluded: [...route.excluded] };
}

// 預設的「還缺什麼」提醒：回傳該邊尚未交付的項目 key。
export function pendingItems(side, rows = []) {
  if (!isSide(side)) return [];
  const stageOf = Object.fromEntries((rows || []).map(row => [row.item_key, row.stage]));
  return AUTH_ITEMS[side].filter(item => stageOf[item] !== 'delivered');
}

// 某筆認證目前能不能記錄進度：已拒絕或已解除就不用再辦了。
export const canTrackProgress = status => status === 'pending' || status === 'certified';
