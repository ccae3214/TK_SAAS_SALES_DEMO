import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  INTRO_SCENE_STARTS, INTRO_VIDEO_DURATION, INTRO_VIDEO_FILES, INTRO_VIDEO_SCENES, INTRO_VIDEO_TEXT,
  introVideoText, sceneIndexAt,
} from '../src/lib/hr-intro-video.js';
import { ONBOARDING_TOURS, TOURS } from '../src/lib/hr-onboarding.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('每個場景都有中英文標題與說明，id 不重複、時間為正數', () => {
  const ids = new Set();
  for (const scene of INTRO_VIDEO_SCENES) {
    assert.ok(scene.id && !ids.has(scene.id), `id 重複或空白：${scene.id}`);
    ids.add(scene.id);
    assert.ok(scene.duration > 0);
    for (const field of ['title', 'caption']) {
      assert.ok(scene[field].zh?.trim(), `${scene.id} 缺中文 ${field}`);
      assert.ok(scene[field].en?.trim(), `${scene.id} 缺英文 ${field}`);
      assert.ok(/[\u4e00-\u9fff]/.test(scene[field].zh), `${scene.id} 中文 ${field} 沒有中文字`);
      assert.ok(!/[\u4e00-\u9fff]/.test(scene[field].en), `${scene.id} 英文 ${field} 混到中文字`);
    }
  }
  assert.equal(INTRO_VIDEO_DURATION, INTRO_VIDEO_SCENES.reduce((sum, scene) => sum + scene.duration, 0));
});

test('介面文字中英文的 key 一致，英文不含中文字', () => {
  assert.deepEqual(Object.keys(INTRO_VIDEO_TEXT.zh).sort(), Object.keys(INTRO_VIDEO_TEXT.en).sort());
  for (const value of Object.values(INTRO_VIDEO_TEXT.en)) assert.ok(!/[\u4e00-\u9fff]/.test(value), value);
  assert.equal(introVideoText('en'), INTRO_VIDEO_TEXT.en);
  assert.equal(introVideoText('fr'), INTRO_VIDEO_TEXT.zh);
});

test('時間軸：依時間找場景，開頭、邊界、超出範圍都正確', () => {
  assert.equal(sceneIndexAt(0), 0);
  assert.equal(sceneIndexAt(-50), 0);
  assert.equal(sceneIndexAt(Number.NaN), 0);
  INTRO_SCENE_STARTS.forEach((start, index) => {
    assert.equal(sceneIndexAt(start), index);
    if (start > 0) assert.equal(sceneIndexAt(start - 1), index - 1);
  });
  assert.equal(sceneIndexAt(INTRO_VIDEO_DURATION), INTRO_VIDEO_SCENES.length - 1);
  assert.equal(sceneIndexAt(INTRO_VIDEO_DURATION * 10), INTRO_VIDEO_SCENES.length - 1);
});

test('真實影片檔路徑中英文各一個，放在 /videos/ 底下', () => {
  assert.match(INTRO_VIDEO_FILES.zh, /^\/videos\/.+\.mp4$/);
  assert.match(INTRO_VIDEO_FILES.en, /^\/videos\/.+\.mp4$/);
  assert.notEqual(INTRO_VIDEO_FILES.zh, INTRO_VIDEO_FILES.en);
});

test('工作者導覽的歡迎步驟有提到介紹影片，且中英文都有', () => {
  assert.ok(ONBOARDING_TOURS.includes('worker'));
  const welcome = TOURS.worker[0];
  assert.ok(welcome.body.zh.includes('介紹影片'));
  assert.ok(welcome.body.en.includes('Intro video'));
});

test('介紹影片只掛在工作者的導覽按鈕旁，並使用 HrIntroVideo 元件', async () => {
  const tour = await read('../src/components/HrOnboardingTour.jsx');
  assert.match(tour, /import HrIntroVideo from '@\/components\/HrIntroVideo'/);
  assert.match(tour, /tourId === 'worker'/);
  const player = await read('../src/components/HrIntroVideo.jsx');
  assert.match(player, /role="dialog"/);
  assert.match(player, /aria-label=\{text\.dialog\}/);
  assert.match(player, /useLanguage/);
});
