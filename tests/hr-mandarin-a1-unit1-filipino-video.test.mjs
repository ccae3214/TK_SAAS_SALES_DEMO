import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Unit 1 learning player offers Filipino narration without replacing the Mandarin version', async () => {
  const component = await readFile('src/components/HrWorkerLearning.jsx', 'utf8');
  // 媒體路徑已改為依單元序號產生（Unit 1 → mandarin-a1-unit-1-fil.*），中文版與 Filipino 版分開。
  assert.match(component, /mandarin-a1-unit-\$\{position\}-fil\.mp4/);
  assert.match(component, /mandarin-a1-unit-\$\{position\}-fil\.mp3/);
  assert.match(component, /mandarin-a1-unit-\$\{position\}-fil\.vtt/);
  assert.match(component, /mandarin-a1-unit-\$\{position\}\.mp4/);
  assert.match(component, /filipinoUnitMediaUrls\(videoUnitPosition\)/);
  assert.match(component, /Filipino na paliwanag/);
  assert.match(component, /setUnitVideoLanguage\('zh'\)/);
});
