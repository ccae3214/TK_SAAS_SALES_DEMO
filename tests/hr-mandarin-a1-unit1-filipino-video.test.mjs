import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

test('Filipino version of Mandarin A1 Unit 1 is playable with captions and Mandarin examples', async () => {
  const videoPath = 'public/videos/mandarin-a1-unit-1-fil.mp4';
  const audioPath = 'public/videos/mandarin-a1-unit-1-fil.mp3';
  const captionsPath = 'public/videos/mandarin-a1-unit-1-fil.vtt';
  for (const file of [videoPath, audioPath, captionsPath]) {
    assert.ok(existsSync(file), `${file} should exist`);
  }

  assert.ok((await stat(videoPath)).size > 1_000_000);
  assert.ok((await stat(audioPath)).size > 500_000);

  const videoInfo = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height',
    '-of', 'json',
    videoPath,
  ], { encoding: 'utf8' }));
  const audioInfo = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type,codec_name',
    '-of', 'json',
    audioPath,
  ], { encoding: 'utf8' }));

  const videoStream = videoInfo.streams.find(stream => stream.codec_type === 'video');
  const videoAudioStream = videoInfo.streams.find(stream => stream.codec_type === 'audio');
  const standaloneAudioStream = audioInfo.streams.find(stream => stream.codec_type === 'audio');
  assert.equal(videoStream.codec_name, 'h264');
  assert.equal(videoStream.width, 1280);
  assert.equal(videoStream.height, 720);
  assert.equal(videoAudioStream.codec_name, 'aac');
  assert.equal(standaloneAudioStream.codec_name, 'mp3');
  assert.ok(Math.abs(Number(videoInfo.format.duration) - Number(audioInfo.format.duration)) <= 0.1);

  const captions = await readFile(captionsPath, 'utf8');
  assert.match(captions, /^WEBVTT/);
  assert.match(captions, /Magandang pagdating|Maligayang pagdating/);
});

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
