// 電腦版通話視窗拖曳移動：純函式（方便單獨測試）。手機版通話視窗佔滿整個畫面，不能拖曳。

// 只有寬度大於這個值才能拖曳（和 hr-call.css 的手機版 @media (max-width: 720px) 對應）
export const CALL_DRAG_MIN_WIDTH = 721;
// 視窗和螢幕邊緣至少保留的距離
export const CALL_DRAG_MARGIN = 8;
// 鍵盤方向鍵每按一下移動的距離（按住 Shift 移動 5 倍）
export const CALL_DRAG_KEY_STEP = 20;

// 把視窗左上角限制在畫面內；畫面比視窗小時貼齊左上角
export function clampCallPosition(position, width, height, viewportWidth, viewportHeight, margin = CALL_DRAG_MARGIN) {
  const maxX = Math.max(margin, viewportWidth - width - margin);
  const maxY = Math.max(margin, viewportHeight - height - margin);
  return {
    x: Math.round(Math.min(Math.max(Number(position?.x) || 0, margin), maxX)),
    y: Math.round(Math.min(Math.max(Number(position?.y) || 0, margin), maxY)),
  };
}

// 方向鍵對應的移動量；不是方向鍵回傳 null
export function keyboardOffset(key, shiftKey = false) {
  const step = CALL_DRAG_KEY_STEP * (shiftKey ? 5 : 1);
  return { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } }[key] || null;
}

export function canDragCallWindow() {
  try { return typeof window !== 'undefined' && window.matchMedia(`(min-width: ${CALL_DRAG_MIN_WIDTH}px)`).matches; } catch { return false; }
}
