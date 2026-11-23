import test from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Mandarin A1 單元 4–20 都有配套 MP4 與 MP3', async () => {
  for (let position = 4; position <= 20; position += 1) {
    const base = `public/videos/mandarin-a1-unit-${position}`;
    const mp4Path = `${base}.mp4`;
    const mp3Path = `${base}.mp3`;
    assert.ok(existsSync(mp4Path), `缺少 ${mp4Path}`);
    assert.ok(existsSync(mp3Path), `缺少 ${mp3Path}`);
    assert.ok((await stat(mp4Path)).size > 200_000, `${mp4Path} 檔案異常`);
    assert.ok((await stat(mp3Path)).size > 100_000, `${mp3Path} 檔案異常`);
  }
});

test('剩餘單元以 seed 課綱內容使用離線 KOKORO 批次生成並由 A1 學習頁播放', async () => {
  const generator = await read('../scripts/generate_mandarin_a1_units_4_20.py');
  const component = await read('../src/components/HrWorkerLearning.jsx');
  const dockerfile = await read('../Dockerfile');
  assert.match(generator, /HF_HUB_OFFLINE/);
  assert.match(generator, /from kokoro import KPipeline/);
  assert.match(generator, /seed-mandarin-a1-course\.sql/);
  assert.match(generator, /range\(4, 21\)/);
  assert.match(component, /isMandarinA1Course/);
  assert.match(component, /unitPosition >= 1 && unitPosition <= 20/);
  assert.match(dockerfile, /COPY --from=builder \/app\/public \.\/public/);
});
