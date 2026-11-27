import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { TL_DICTIONARY } from '../src/data/tl-dictionary.js';
import { copyStylesTo, pickPipVideo, pictureInPictureMode, pipWindowSize } from '../src/lib/hr-call-pip.js';

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

test('依瀏覽器決定彈出方式：Document PiP 優先，Safari 只彈出影像，其他不支援', () => {
  assert.equal(pictureInPictureMode({ documentPictureInPicture: { requestWindow() {} }, document: { pictureInPictureEnabled: true } }), 'document');
  assert.equal(pictureInPictureMode({ document: { pictureInPictureEnabled: true } }), 'video');
  assert.equal(pictureInPictureMode({ document: {} }), null);
  assert.equal(pictureInPictureMode(undefined), null);
});

test('彈出視窗大小沿用通話視窗並限制範圍', () => {
  assert.deepEqual(pipWindowSize({ width: 720.4, height: 520 }), { width: 720, height: 520 });
  assert.deepEqual(pipWindowSize({ width: 5000, height: 100 }), { width: 1200, height: 240 });
  assert.deepEqual(pipWindowSize(null), { width: 720, height: 520 });
});

test('複製樣式：讀得到內容就複製文字，跨網域樣式改用 link', () => {
  const appended = [];
  const target = { createElement: tag => ({ tag }), head: { appendChild: node => appended.push(node) } };
  const source = { styleSheets: [
    { cssRules: [{ cssText: '.a{color:red}' }, { cssText: '.b{color:blue}' }] },
    { get cssRules() { throw new Error('SecurityError'); }, href: 'https://cdn.example/x.css', media: { mediaText: 'screen' } },
    { get cssRules() { throw new Error('SecurityError'); }, href: null },
  ] };
  copyStylesTo(source, target);
  assert.equal(appended.length, 2);
  assert.equal(appended[0].tag, 'style'); assert.equal(appended[0].textContent, '.a{color:red}\n.b{color:blue}');
  assert.equal(appended[1].tag, 'link'); assert.equal(appended[1].href, 'https://cdn.example/x.css'); assert.equal(appended[1].media, 'screen');
});

test('Safari 彈出影像：優先放大中的人，其次第一個有影像的對方', () => {
  const calls = [];
  const root = { querySelector: selector => { calls.push(selector); return selector.includes('is-focused') ? null : 'peer-video'; } };
  assert.equal(pickPipVideo(root), 'peer-video');
  assert.ok(calls[0].includes('is-focused') && calls[1].includes(':not(.is-local)'));
  assert.equal(pickPipVideo(null), null);
});

test('通話視窗用 portal 搬到彈出視窗；網頁留提示可移回；掛斷時關閉', async () => {
  const provider = await read('../src/components/HrCallProvider.jsx');
  const css = await read('../src/components/hr-call.css');
  assert.ok(provider.indexOf('const [pipWindow, setPipWindow] = useState(null);') < provider.indexOf('if (!state) return null;'), 'hook 要在 return 之前');
  assert.ok(provider.includes('createPortal(overlay, pipWindow.document.body)'));
  assert.ok(provider.includes('window.documentPictureInPicture.requestWindow(pipWindowSize('));
  assert.ok(provider.includes("win.addEventListener('pagehide'"), '關閉彈出視窗要回到網頁');
  assert.ok(provider.includes('pipRoomRef.current !== callRoomId) { pipWindow.close();'), '掛斷要關閉彈出視窗');
  assert.ok(provider.includes('className="hr-call-pip-placeholder"'));
  assert.ok(provider.includes("setPipMode(canDragCallWindow() ? pictureInPictureMode() : null)"), '只在電腦版顯示');
  assert.ok(css.includes('.hr-call-overlay.in-pip-window { inset: 0; width: auto; height: auto;'));
});

test('彈出文字有中文、英文、Filipino', async () => {
  const provider = await read('../src/components/HrCallProvider.jsx');
  assert.ok(provider.includes("popIn: '移回網頁'") && provider.includes("popIn: 'Move back into the page'"));
  for (const english of ['Pop out to the desktop (can be moved outside the browser)', 'Pop out the video to the desktop (can be moved outside the browser)', 'Move back into the page', 'The call window is popped out to the desktop']) {
    assert.ok(TL_DICTIONARY[english], `缺 Filipino：${english}`);
  }
});
