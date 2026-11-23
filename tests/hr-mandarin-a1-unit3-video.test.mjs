import test from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Mandarin A1 第 3 單元影音檔存在且可供學習頁播放', async () => {
  const mp4Path = 'public/videos/mandarin-a1-unit-3.mp4';
  const mp3Path = 'public/videos/mandarin-a1-unit-3.mp3';
  assert.ok(existsSync(mp4Path), 'MP4 檔案應存在於 public/videos/');
  assert.ok(existsSync(mp3Path), 'MP3 檔案應存在於 public/videos/');
  assert.ok((await stat(mp4Path)).size > 1_000_000, 'MP4 大小應大於 1MB');
  assert.ok((await stat(mp3Path)).size > 500_000, 'MP3 大小應大於 500KB');

  const component = await read('../src/components/HrWorkerLearning.jsx');
  assert.match(component, /mandarin-a1-unit-\$\{position\}\.mp4/);
  assert.match(component, /mandarin-a1-unit-\$\{position\}\.mp3/);
  assert.match(component, /const isAvailableA1Video =/);
});

test('單元 3 配音與影片腳本使用本地 Kokoro 並輸出對應檔名', async () => {
  const audioScript = await read('../scripts/generate_unit3_audio.py');
  const videoScript = await read('../scripts/build_unit3_video.py');
  const slideScript = await read('../scripts/generate_unit3_slides.py');
  assert.match(audioScript, /from kokoro import KPipeline/);
  assert.match(audioScript, /mandarin-a1-unit-3/);
  assert.match(videoScript, /mandarin-a1-unit-3\.mp4/);
  assert.match(videoScript, /mandarin-a1-unit-3\.mp3/);
  assert.match(slideScript, /Numbers, Dates & Time/);
});
