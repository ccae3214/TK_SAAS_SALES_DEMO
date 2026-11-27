import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Unit 1 learning player offers Filipino narration without replacing the Mandarin version', async () => {
  const component = await readFile('src/components/HrWorkerLearning.jsx', 'utf8');
  assert.match(component, /mandarin-a1-unit-1-fil\.mp4/);
  assert.match(component, /mandarin-a1-unit-1-fil\.mp3/);
  assert.match(component, /mandarin-a1-unit-1-fil\.vtt/);
  assert.match(component, /Filipino na paliwanag/);
  assert.match(component, /setUnitVideoLanguage\('zh'\)/);
});
