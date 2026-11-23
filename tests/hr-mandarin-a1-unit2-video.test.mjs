import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('Mandarin A1 第 2 單元影音檔完整存在且格式合規', async () => {
  const mp4Path = 'public/videos/mandarin-a1-unit-2.mp4';
  const mp3Path = 'public/videos/mandarin-a1-unit-2.mp3';

  assert.ok(existsSync(mp4Path), 'MP4 檔案應存在於 public/videos/');
  assert.ok(existsSync(mp3Path), 'MP3 檔案應存在於 public/videos/');

  const mp4Stat = await stat(mp4Path);
  assert.ok(mp4Stat.size > 1_000_000, `MP4 大小應大於 1MB（目前 ${mp4Stat.size} 位元組）`);

  const mp3Stat = await stat(mp3Path);
  assert.ok(mp3Stat.size > 500_000, `MP3 大小應大於 500KB（目前 ${mp3Stat.size} 位元組）`);

  // 使用 ffprobe 檢查串流編碼
  const probeOut = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,codec_name,width,height',
    '-of', 'json',
    mp4Path,
  ], { encoding: 'utf8' });

  const info = JSON.parse(probeOut);
  const vStream = info.streams.find(s => s.codec_type === 'video');
  const aStream = info.streams.find(s => s.codec_type === 'audio');

  assert.ok(vStream, '應包含視訊串流');
  assert.equal(vStream.codec_name, 'h264', '視訊編碼應為 h264');
  assert.equal(vStream.width, 1280, '視訊寬度應為 1280');
  assert.equal(vStream.height, 720, '視訊高度應為 720');

  assert.ok(aStream, '應包含音訊串流');
  assert.equal(aStream.codec_name, 'aac', '音訊編碼應為 aac');
});
