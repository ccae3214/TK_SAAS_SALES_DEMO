// 訓練中心工作者名單的「訓練狀態」自動判斷（純函式，不依賴資料庫，方便用 node 測試）。
//   沒有報名任何班別 → 沿用手動更新的狀態（「更新狀態」下拉選單）
//   已報名班別       → 訓練中
//   報名班別的訓練結束日都已過 → 結訓（未取證）
//   取得證照（報名班別的證照批次已發證，或工人上傳的證照文件已核准） → 結訓已取證
// 工人上傳的證照文件要有報名班別才算，避免把工人在報名前就有的舊證照當成這次訓練的取證。

export const TRAINING_STATUS_RANK = { not_scheduled: 0, scheduled: 1, in_progress: 2, completed: 3, certified: 4 };

// 台灣時間的今天（YYYY-MM-DD）。
export function taipeiToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// classes: [{ end, issued }]（end：訓練結束日 YYYY-MM-DD；issued：該班別有證照批次已發證）
// 回傳 { status, auto }：auto 為 true 表示由報名資料自動判斷。
export function deriveTrainingStatus({ manualStatus, classes, certificateApproved, today }) {
  const manual = TRAINING_STATUS_RANK[manualStatus] === undefined ? 'not_scheduled' : manualStatus;
  const list = Array.isArray(classes) ? classes : [];
  if (!list.length) return { status: manual, auto: false };
  if (list.some(item => item.issued) || certificateApproved) return { status: 'certified', auto: true };
  const finished = list.every(item => item.end && String(item.end).slice(0, 10) < today);
  return { status: finished ? 'completed' : 'in_progress', auto: true };
}
