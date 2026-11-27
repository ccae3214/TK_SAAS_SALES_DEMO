import os
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from voxcpm import VoxCPM


ROOT = Path(__file__).resolve().parents[1]
WORK_DIR = ROOT / "tmp" / "mandarin_a1_unit1_voxcpm2_audition"
OUTPUT_DIR = ROOT / "deliverables"
MODEL_ID = "openbmb/VoxCPM2"
TONE_SAMPLES = [("媽", "ma1, first tone"), ("麻", "ma2, second tone"), ("馬", "ma3, third tone"), ("罵", "ma4, fourth tone")]
VOICE_CONTROL = (
    "A clear adult male voice speaking standard Mandarin Chinese, with careful tones, "
    "natural pronunciation, and a steady, unhurried pace."
)
REFERENCE_TEXT = "你好，我來示範標準普通話發音。"
GAP_SECONDS = 1.5


def main() -> None:
    os.environ["HF_HUB_OFFLINE"] = "1"
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

    reference_path = WORK_DIR / "mandarin_demo_voice_reference.wav"
    reference = model.generate(
        text=f"({VOICE_CONTROL}){REFERENCE_TEXT}",
        cfg_value=2.0,
        inference_timesteps=10,
    )
    if reference.size == 0 or not np.isfinite(reference).all():
        raise RuntimeError("VoxCPM2 returned an invalid Mandarin voice reference")
    sf.write(reference_path, reference, sample_rate)
    print(f"Created one Mandarin voice reference at {sample_rate} Hz.", flush=True)

    pieces = []
    labels = []
    silence = np.zeros(round(sample_rate * GAP_SECONDS), dtype=np.float32)
    for index, (character, tone_name) in enumerate(TONE_SAMPLES):
        audio = model.generate(
            text=character,
            reference_wav_path=str(reference_path),
            cfg_value=2.0,
            inference_timesteps=10,
            retry_badcase=True,
            retry_badcase_max_times=2,
        )
        audio = np.asarray(audio, dtype=np.float32).reshape(-1)
        if audio.size == 0 or not np.isfinite(audio).all():
            raise RuntimeError(f"VoxCPM2 returned invalid audio for {character}")
        sample_path = WORK_DIR / f"tone-{index + 1}-{character}.wav"
        sf.write(sample_path, audio, sample_rate)
        pieces.append(audio)
        labels.append(f"{character} ({tone_name})")
        if index < len(TONE_SAMPLES) - 1:
            pieces.append(silence)
        print(f"Generated {character} ({tone_name}), {len(audio) / sample_rate:.2f}s.", flush=True)

    audition = np.concatenate(pieces)
    wav_path = OUTPUT_DIR / "mandarin-a1-unit1-voxcpm2-tone-audition.wav"
    mp3_path = OUTPUT_DIR / "mandarin-a1-unit1-voxcpm2-tone-audition.mp3"
    notes_path = OUTPUT_DIR / "mandarin-a1-unit1-voxcpm2-tone-audition.txt"
    sf.write(wav_path, audition, sample_rate)
    notes_path.write_text(
        "VoxCPM2 普通話單音節試聽順序\n\n" + "\n".join(labels) + "\n",
        encoding="utf-8",
    )
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
