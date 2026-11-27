// 訓練中心清單的顯示順序：先照資料庫的排序（啟用中在前、再依名稱），
// 再把 q8 和 kolecion 這兩個訓練中心的位置對調，讓系統管理員進來第一個看到（預設選到）的是 kolecion。
// 其他訓練中心的位置不變。名稱比對不分大小寫、只要名稱裡有這個字就算。
// 這個檔案不 import '@/…'，node:test 可以直接測試。

export const SWAP_CENTER_NAMES = ['q8', 'kolecion'];

const nameOf = center => String(center?.display_name || '').toLowerCase();

export function orderTrainingCenters(centers = [], [first, second] = SWAP_CENTER_NAMES) {
  const list = [...centers];
  const a = list.findIndex(center => nameOf(center).includes(first));
  const b = list.findIndex(center => nameOf(center).includes(second));
  // 兩個都找到、而且 q8 排在 kolecion 前面才對調（已經是 kolecion 在前就不動）
  if (a >= 0 && b >= 0 && a < b) [list[a], list[b]] = [list[b], list[a]];
  return list;
}
