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

test('Filipino audio generator uses the local Filipino SpeechT5 model and preserves Kokoro examples', async () => {
  const generator = await readFile('scripts/generate_unit1_filipino_audio.mjs', 'utf8');
  assert.match(generator, /internetoftim\/speecht5_tts-pld-fil-ONNX/);
  assert.match(generator, /mandarinSample/);
  assert.match(generator, /kokoro_a1_unit1/);
});
