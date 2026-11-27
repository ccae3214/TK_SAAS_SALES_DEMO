import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

from moss_tts import MossTTS


ROOT = Path(__file__).resolve().parents[1]
WORK_DIR = ROOT / "tmp" / "moss_tts_mandarin_audition"
OUTPUT_DIR = ROOT / "deliverables"
VOICE_REFERENCE = (
    ROOT
    / "tmp"
    / "mandarin_a1_unit1_voxcpm2_audition"
    / "mandarin_demo_voice_reference.wav"
)
TARGETS = [
    ("ma2", "麻", "第二聲"),
    ("ma3", "馬", "第三聲"),
]
GAP_SECONDS = 1.5


def main() -> None:
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    tts = MossTTS(VOICE_REFERENCE)
    sample_rate = tts.sample_rate
    silence = np.zeros(round(sample_rate * GAP_SECONDS), dtype=np.float32)
    audition_parts = []
    notes = [
        "MOSS-TTS 普通話單音節聲調試聽",
        "同一段普通話男聲參考音色。MOSS-TTS 直接讀取漢字，避免把拼音當成正文。",
        "順序：麻 ma2（第二聲），馬 ma3（第三聲）。",
        "兩段之間停 1.5 秒。",
        "",
    ]

    for index, (pinyin, character, tone_name) in enumerate(TARGETS):
        print(f"Generating {character} ({pinyin}, {tone_name})...", flush=True)
        waveform = tts.synthesize(character)

        sample_path = WORK_DIR / f"{pinyin}.wav"
        sf.write(sample_path, waveform, sample_rate)
        audition_parts.append(waveform)
        if index < len(TARGETS) - 1:
            audition_parts.append(silence)
        print(f"Created {character} sample, {len(waveform) / sample_rate:.2f}s.", flush=True)

    combined = np.concatenate(audition_parts)
    wav_path = OUTPUT_DIR / "mandarin-a1-unit1-moss-tts-tone-audition.wav"
    mp3_path = OUTPUT_DIR / "mandarin-a1-unit1-moss-tts-tone-audition.mp3"
    notes_path = OUTPUT_DIR / "mandarin-a1-unit1-moss-tts-tone-audition.txt"
    sf.write(wav_path, combined, sample_rate)
    notes_path.write_text("\n".join(notes), encoding="utf-8")
    result = subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(wav_path), "-c:a", "libmp3lame", "-qscale:a", "2",
            "-ar", "48000", str(mp3_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode:
        raise RuntimeError(f"MP3 encoding failed:\n{result.stderr[-2000:]}")
    print(f"Created {mp3_path}", flush=True)
    print(f"Created {wav_path}", flush=True)
    print(f"Created {notes_path}", flush=True)


if __name__ == "__main__":
    main()
