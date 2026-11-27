// node:test 用的模組解析：把 Next.js 的 `@/…` 別名（jsconfig.json：@/* → ./src/*）對應到實際檔案，
// 讓 import '@/lib/…' 的模組也能直接在 node:test 裡載入與測試，不必只讀原始碼字串比對。
// 與 Next 一樣允許省略副檔名：依序嘗試原路徑、.js、.mjs、/index.js。只影響測試，不影響正式程式。
// 另外補上 Next 打包器允許、但 Node ESM 不允許的兩種寫法：next/server（無副檔名）與資料夾 import。
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const srcDir = new URL('../../src/', import.meta.url);
const CANDIDATES = ['', '.js', '.mjs', '/index.js'];

const isFile = url => {
  const file = fileURLToPath(url);
  return existsSync(file) && statSync(file).isFile();
};

export function resolveAlias(specifier) {
  if (!specifier.startsWith('@/')) return null;
  const base = new URL(specifier.slice(2), srcDir);
  for (const suffix of CANDIDATES) {
    const candidate = new URL(base.href + suffix);
    if (isFile(candidate)) return pathToFileURL(fileURLToPath(candidate)).href;
  }
  return null;
}

// 可以補副檔名的寫法：相對路徑（./_shared、./_post）與 next/server 這類 next 子路徑
// （next 套件沒有 exports 對照表，Node ESM 必須寫 next/server.js）。最後一段已有副檔名的不處理。
const NEEDS_EXTENSION = /^(\.{1,2}\/|next\/)(?:.*\/)?[^/.]+\/?$/;
const RETRYABLE = new Set(['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT']);

export async function resolve(specifier, context, nextResolve) {
  const url = resolveAlias(specifier);
  if (url) return { url, shortCircuit: true };
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!RETRYABLE.has(error?.code) || !NEEDS_EXTENSION.test(specifier)) throw error;
    const base = specifier.replace(/\/$/, '');
    for (const candidate of [`${base}.js`, `${base}/index.js`]) {
      try { return await nextResolve(candidate, context); } catch { /* 試下一個 */ }
    }
    throw error;
  }
}
