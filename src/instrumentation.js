// Next.js 在伺服器啟動時呼叫一次 register()，而且會等它完成才開始處理請求。資料庫與 LINE 推播只能在 Node 環境執行，
// 所以放在 instrumentation-node.js，並且只在 NEXT_RUNTIME 是 nodejs 時載入（寫成這個形式，Edge 版本的打包才會略過它）。
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerNode } = await import('./instrumentation-node');
    await registerNode();
  }
}
