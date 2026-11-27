import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { TL_DICTIONARY } from '../src/data/tl-dictionary.js';
import { clampCallPosition, keyboardOffset, CALL_DRAG_MIN_WIDTH } from '../src/lib/hr-call-drag.js';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

test('拖曳位置限制在畫面內，畫面太小時貼齊左上角', () => {
  assert.deepEqual(clampCallPosition({ x: 100, y: 50 }, 720, 520, 1440, 900), { x: 100, y: 50 });
  assert.deepEqual(clampCallPosition({ x: -300, y: -20 }, 720, 520, 1440, 900), { x: 8, y: 8 });
  assert.deepEqual(clampCallPosition({ x: 5000, y: 5000 }, 720, 520, 1440, 900), { x: 712, y: 372 });
  assert.deepEqual(clampCallPosition({ x: 300, y: 300 }, 1040, 520, 800, 500), { x: 8, y: 8 });
});

test('方向鍵移動，Shift 移動 5 倍，其他按鍵不動', () => {
  assert.deepEqual(keyboardOffset('ArrowLeft'), { x: -20, y: 0 });
  assert.deepEqual(keyboardOffset('ArrowDown', true), { x: 0, y: 100 });
  assert.equal(keyboardOffset('Enter'), null);
});

test('電腦版拖曳標題列移動視窗；手機版不能拖曳；換一通電話回到右下角', async () => {
  const provider = await read('../src/components/HrCallProvider.jsx');
  const css = await read('../src/components/hr-call.css');
  assert.ok(provider.indexOf('const [position, setPosition] = useState(null);') < provider.indexOf('if (!state) return null;'), 'hook 要在 return 之前');
  assert.ok(provider.includes('setPosition(null); dragRef.current = null; }, [callRoomId]);'));
  assert.ok(provider.includes("style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}"));
  assert.ok(provider.includes('className="hr-call-header hr-call-drag-handle"') && provider.includes('{...drag}'));
  assert.ok(provider.includes('setPointerCapture') && provider.includes('onDoubleClick: () => setPosition(null)'));
  assert.equal(CALL_DRAG_MIN_WIDTH, 721, '要和手機版 @media (max-width: 720px) 對應');
  assert.ok(css.includes('.hr-call-drag-handle {') && css.includes('cursor: grab; touch-action: none;'));
  const mobile = css.slice(css.indexOf('@media (max-width: 720px)'));
  assert.ok(mobile.includes('.hr-call-drag-handle { margin: 0; padding: 0; border-radius: 0; cursor: default; touch-action: auto; }'));
});

test('移動視窗提示有中文、英文、Filipino', async () => {
  const provider = await read('../src/components/HrCallProvider.jsx');
  const english = 'Drag here to move the call window (arrow keys also work; double-click to return it to the bottom right)';
  assert.ok(provider.includes("moveWindow: '拖曳這裡移動通話視窗") && provider.includes(`moveWindow: '${english}'`));
  assert.ok(TL_DICTIONARY[english]);
});
