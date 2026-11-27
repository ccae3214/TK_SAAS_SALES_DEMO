import os
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from voxcpm import VoxCPM


ROOT = Path(__file__).resolve().parents[1]
WORK_DIR = ROOT / "tmp" / "mandarin_a1_unit1_voxcpm2_tone_context"
OUTPUT_DIR = ROOT / "deliverables"
MODEL_ID = "openbmb/VoxCPM2"
REFERENCE_PATH = (
    ROOT
    / "tmp"
    / "mandarin_a1_unit1_voxcpm2_audition"
    / "mandarin_demo_voice_reference.wav"
)
SAMPLES = [
    ("麻", "麻，麻木的麻。", "second tone"),
    ("馬", "馬，馬字的馬。", "third tone"),
]
GAP_SECONDS = 1.6


def main() -> None:
    os.environ["HF_HUB_OFFLINE"] = "1"
    if not REFERENCE_PATH.is_file():
        raise FileNotFoundError(f"Missing VoxCPM2 Mandarin voice reference: {REFERENCE_PATH}")
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading the local VoxCPM2 model on CPU...", flush=True)
    model = VoxCPM.from_pretrained(
        MODEL_ID,
        load_denoiser=False,
        local_files_only=True,
        optimize=False,
        device="cpu",
    )
    sample_rate = int(model.tts_model.sample_rate)
    silence = np.zeros(round(sample_rate * GAP_SECONDS), dtype=np.float32)
    parts = []
    labels = [
        "VoxCPM2 單音節聲調情境試聽",
        "同一位普通話男聲。每段以目標單音節開頭，後接詞語語境。",
        "順序：麻（第二聲，麻木的麻）；馬（第三聲，馬字的馬）。",
        "",
    ]

    for index, (character, text, tone) in enumerate(SAMPLES):
        audio = model.generate(
            text=text,
            reference_wav_path=str(REFERENCE_PATH),
            cfg_value=2.0,
            inference_timesteps=10,
            retry_badcase=True,
            retry_badcase_max_times=2,
        )
        audio = np.asarray(audio, dtype=np.float32).reshape(-1)
        if audio.size == 0 or not np.isfinite(audio).all():
            raise RuntimeError(f"VoxCPM2 returned invalid audio for {character}")
        phrase_path = WORK_DIR / f"tone-{index + 2}-context.wav"
        sf.write(phrase_path, audio, sample_rate)
        parts.append(audio)
        if index < len(SAMPLES) - 1:
            parts.append(silence)
        print(f"Generated {character} context ({tone}), {len(audio) / sample_rate:.2f}s.", flush=True)

    audition = np.concatenate(parts)
    wav_path = OUTPUT_DIR / "mandarin-a1-unit1-voxcpm2-tone-audition-v3.wav"
    mp3_path = OUTPUT_DIR / "mandarin-a1-unit1-voxcpm2-tone-audition-v3.mp3"
    notes_path = OUTPUT_DIR / "mandarin-a1-unit1-voxcpm2-tone-audition-v3.txt"
    sf.write(wav_path, audition, sample_rate)
    notes_path.write_text("\n".join(labels), encoding="utf-8")
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
