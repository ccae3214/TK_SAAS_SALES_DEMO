// 訓練中心會員實際操作的訓練中心編號（純函式，不碰資料庫，方便 node:test 直接載入）。
// 成員用所屬中心（training_center_id），中心本人用自己的編號；其他角色回傳 null。
export function trainingCenterIdOf(principal) {
  if (principal?.role !== 'training_center') return null;
  return principal.training_center_id || principal.id || null;
}
