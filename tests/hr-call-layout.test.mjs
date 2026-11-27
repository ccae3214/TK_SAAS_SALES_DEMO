import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { TL_DICTIONARY } from '../src/data/tl-dictionary.js';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

test('視訊畫面並排：不再把自己縮成角落小畫面，依人數排成 1／2／3 欄，手機兩人上下排', async () => {
  const provider = await read('../src/components/HrCallProvider.jsx');
  const css = await read('../src/components/hr-call.css');
  assert.ok(!provider.includes('is-pip') && !css.includes('is-pip'), '一對一也要並排');
  assert.ok(css.includes('.hr-call-grid { position: relative; display: grid;') && css.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
  assert.ok(css.includes('.hr-call-grid.count-5, .hr-call-grid.count-6 { grid-template-columns: repeat(3, minmax(0, 1fr)); }'));
  const mobile = css.slice(css.indexOf('@media (max-width: 720px)'));
  assert.ok(mobile.includes('.hr-call-grid.count-2 { grid-template-columns: 1fr; }'));
});

test('點某個人的畫面放大，再點一次回到並排；鍵盤可操作；放大的人離開就回到並排', async () => {
  const provider = await read('../src/components/HrCallProvider.jsx');
  const css = await read('../src/components/hr-call.css');
  assert.ok(provider.includes('const [focusedId, setFocusedId] = useState(null);'));
  assert.ok(provider.indexOf('useState(null)') < provider.indexOf('if (!state) return null;'), 'hook 要在 return 之前');
  assert.ok(provider.includes('setFocusedId(current => (current === id ? null : id))'));
  assert.ok(provider.includes("call.peers.some(peer => String(peer.id) === focusedId)"), '放大的人離開要自動回到並排');
  assert.ok(provider.includes("role: 'button', tabIndex: 0, 'aria-pressed': focused") && provider.includes("event.key === 'Enter' || event.key === ' '"));
  assert.ok(provider.includes('const selectable = tileCount > 1;'), '只有自己時不能放大');
  assert.ok(css.includes('.hr-call-grid.has-focus .hr-call-tile.is-focused { order: 0; grid-column: 1 / -1; }'));
  assert.ok(css.includes('.hr-call-tile.is-focused video { object-fit: contain;'), '放大時顯示完整畫面不裁切');
});

test('放大／回到並排的文字有中文、英文、Filipino', async () => {
  const provider = await read('../src/components/HrCallProvider.jsx');
  assert.ok(provider.includes("enlarge: '放大畫面', backToGrid: '回到並排畫面'"));
  assert.ok(provider.includes("enlarge: 'Enlarge video', backToGrid: 'Back to side-by-side view'"));
  for (const english of ['Enlarge video', 'Back to side-by-side view', 'Turn speaker off', 'Turn speaker on']) assert.ok(TL_DICTIONARY[english], `缺 Filipino：${english}`);
});
