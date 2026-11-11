import { useEffect, useRef } from 'react';

const FIELD_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * 使用者回到此分頁／視窗時，自動重新讀取資料（visibilitychange / focus）。
 *
 * 以下情況會略過這次更新，避免覆蓋使用者正在處理的內容：
 *  - 分頁在背景
 *  - 距離上次更新不到 minIntervalMs（預設 10 秒）
 *  - 游標停在表單欄位（<form> 內的 input / textarea / select）或 contenteditable
 *  - 畫面上有開著的彈窗（role="dialog" aria-modal="true"）
 *  - 呼叫端的 shouldSkip() 回傳 true（例如儲存中、編輯中）
 *
 * @param {() => Promise<unknown>|unknown} refresh 重新讀取資料的函式；失敗時不會打擾使用者
 * @param {{ shouldSkip?: () => boolean, minIntervalMs?: number }} [options]
 */
export function useAutoRefresh(refresh, { shouldSkip, minIntervalMs = 10000 } = {}) {
  const refreshRef = useRef(refresh);
  const skipRef = useRef(shouldSkip);
  useEffect(() => {
    refreshRef.current = refresh;
    skipRef.current = shouldSkip;
  });

  useEffect(() => {
    let lastRun = Date.now();
    let running = false;

    async function run() {
      if (running || document.visibilityState !== 'visible') return;
      if (Date.now() - lastRun < minIntervalMs) return;
      const el = document.activeElement;
      if (el && ((FIELD_TAGS.has(el.tagName) && el.closest('form')) || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (skipRef.current?.()) return;
      running = true;
      try {
        await refreshRef.current?.();
      } catch {
        // 背景更新失敗（例如網路暫時中斷）不顯示錯誤，下次回到頁面時再試。
      } finally {
        lastRun = Date.now();
        running = false;
      }
    }

    document.addEventListener('visibilitychange', run);
    window.addEventListener('focus', run);
    return () => {
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('focus', run);
    };
  }, [minIntervalMs]);
}
