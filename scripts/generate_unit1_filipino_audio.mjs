import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const sourceDir = path.resolve('tmp/kokoro_a1_unit1');
const outputDir = path.resolve('tmp/kokoro_a1_unit1_filipino');
const sampleDir = path.join(outputDir, 'mandarin_samples');
const filipinoVoiceDir = path.join(outputDir, 'filipino_voice');
const sampleRate = 16_000;

const scenes = [
  {
    id: '01_cover',
    caption:
      'Maligayang pagdating sa kursong Mandarin A1 ng Kolecion Training Center. Sa Unang Yunit, pag-aaralan natin ang wastong pagbigkas at mga tono.',
  },
  {
    id: '02_objectives',
    caption:
      'Matututuhan natin ang Zhuyin at Pinyin, ang apat na pangunahing tono at neutral tone, mga pagbabago sa tono, at mahahalagang pananalita sa klase.',
  },
  {
    id: '03_tones',
    caption:
      'Sa Mandarin, mahalagang bigkasin ang tamang tono dahil maaari nitong baguhin ang kahulugan ng salita. Makinig sa mga halimbawa at ulitin pagkatapos ng guro.',
    mandarinSample: '03_tones',
  },
  {
    id: '04_tone_sandhi',
    caption:
      'Kapag magkasunod ang dalawang salitang may ikatlong tono, nagiging ikalawang tono ang una. Nagbabago rin ang bigkas ng bu at yi depende sa kasunod na tono. Pakinggan ang mga halimbawang Mandarin.',
    mandarinSample: '04_tone_sandhi',
  },
  {
    id: '05_vocab_basics',
    caption:
      'Tingnan ang mga pangunahing salita sa slide. Makinig sa bigkas ng guro at ulitin ang bawat salita.',
    mandarinSample: '05_vocab_basics',
  },
  {
    id: '06_vocab_courtesy',
    caption:
      'Pag-aralan ang mga salitang ginagamit sa pagbibigay-galang at sa klase. Pakinggan ang tamang bigkas at sabayan ang guro.',
    mandarinSample: '06_vocab_courtesy',
  },
  {
    id: '07_examples',
    caption:
      'Narito ang mga karaniwang pangungusap sa klase. Gamitin ang pakiulit kung hindi mo narinig nang mabuti, at sabihin na hindi mo naiintindihan kung kailangan mo ng tulong.',
    mandarinSample: '07_examples',
  },
  {
    id: '08_dialogue',
    caption:
      'Magsanay tayo sa isang maikling usapan sa klase. Makinig sa guro at kay Wang Ming. Pansinin kung paano magpakilala at magalang na humiling na ulitin ang sinabi.',
    mandarinSample: '08_dialogue',
  },
  {
    id: '09_conclusion',
    caption:
      'Binabati kita! Natapos mo ang Unang Yunit tungkol sa pagbigkas at mga tono. Balikan at sanayin ang mga salita at pangungusap. Magkita tayo sa Ikalawang Yunit tungkol sa pagbati at pagpapakilala.',
  },
];

function runFfmpeg(args, input) {
  const result = spawnSync('ffmpeg', args, {
    input,
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.toString('utf8').slice(-2_000));
  }
  return result.stdout;
}

function resampleToFloat32(wavPath) {
  const output = runFfmpeg([
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    wavPath,
    '-f',
    'f32le',
    '-ac',
    '1',
    '-ar',
    String(sampleRate),
    'pipe:1',
  ]);
  if (output.byteLength % 4 !== 0) {
    throw new Error(`Unexpected PCM byte length for ${wavPath}`);
  }
  const samples = new Float32Array(output.byteLength / 4);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = output.readFloatLE(i * 4);
  }
  return samples;
}

function concatenateAudio(parts) {
  const totalSamples = parts.reduce((total, part) => total + part.length, 0);
  const result = new Float32Array(totalSamples);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function silence(seconds) {
  return new Float32Array(Math.round(sampleRate * seconds));
}

function writeWav(samples, wavPath) {
  const dataLength = samples.length * 2;
  const output = Buffer.alloc(44 + dataLength);
  output.write('RIFF', 0);
  output.writeUInt32LE(36 + dataLength, 4);
  output.write('WAVE', 8);
  output.write('fmt ', 12);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36);
  output.writeUInt32LE(dataLength, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    output.writeInt16LE(Math.round(sample * 32_767), 44 + i * 2);
  }
  return writeFile(wavPath, output);
}

function toVttTimestamp(seconds) {
  const milliseconds = Math.round(seconds * 1_000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const remainingSeconds = Math.floor((milliseconds % 60_000) / 1_000);
  const remainder = milliseconds % 1_000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}.${String(remainder).padStart(3, '0')}`;
}

for (const scene of scenes) {
  const sourcePng = path.join(sourceDir, `${scene.id}.png`);
  await readFile(sourcePng);
}

await mkdir(outputDir, { recursive: true });
const reuseFilipino = process.argv.includes('--reuse-filipino');
if (reuseFilipino) {
  for (const scene of scenes) {
    await readFile(path.join(filipinoVoiceDir, `${scene.id}.wav`));
  }
}

const generationScripts = reuseFilipino
  ? ['generate_unit1_mandarin_examples.py']
  : ['generate_unit1_mandarin_examples.py', 'generate_unit1_filipino_speech.py'];
for (const script of generationScripts) {
  const result = spawnSync('python', [path.resolve(`scripts/${script}`)], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${script} failed with exit code ${result.status}`);
  }
}

const metadata = [];
const allAudioParts = [];
const captionCues = [];
let timelineOffset = 0;

for (const scene of scenes) {
  const narrationAudio = resampleToFloat32(
    path.join(filipinoVoiceDir, `${scene.id}.wav`),
  );
  const parts = [narrationAudio];
  if (scene.mandarinSample) {
    parts.push(silence(0.4));
    parts.push(resampleToFloat32(path.join(sampleDir, `${scene.mandarinSample}.wav`)));
  }
  parts.push(silence(0.6));
  const audio = concatenateAudio(parts);
  const wavPath = path.join(outputDir, `${scene.id}.wav`);
  await writeWav(audio, wavPath);

  const narrationDuration = narrationAudio.length / sampleRate;
  const duration = audio.length / sampleRate;
  metadata.push({
    id: scene.id,
    title: scene.id,
    duration,
    narrationDuration,
    wav_path: wavPath,
    slide_path: path.join(sourceDir, `${scene.id}.png`),
  });
  captionCues.push(
    `${toVttTimestamp(timelineOffset)} --> ${toVttTimestamp(timelineOffset + narrationDuration)}\n${scene.caption}`,
  );
  timelineOffset += duration;
  allAudioParts.push(audio);
  console.log(`Generated ${scene.id}: ${duration.toFixed(2)}s`);
}

await writeWav(
  concatenateAudio(allAudioParts),
  path.join(outputDir, 'mandarin-a1-unit-1-fil-master.wav'),
);
await writeFile(path.join(outputDir, 'scenes.json'), JSON.stringify(metadata, null, 2), 'utf8');
await writeFile(
  path.join(outputDir, 'mandarin-a1-unit-1-fil.vtt'),
  `WEBVTT\n\n${captionCues.join('\n\n')}\n`,
  'utf8',
);
console.log(`Filipino narration and captions saved to ${outputDir}`);
