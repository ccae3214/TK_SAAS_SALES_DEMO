import os
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from voxcpm import VoxCPM


ROOT = Path(__file__).resolve().parents[1]
WORK_DIR = ROOT / "tmp" / "mandarin_a1_unit1_voxcpm2_tone_revision"
OUTPUT_DIR = ROOT / "deliverables"
MODEL_ID = "openbmb/VoxCPM2"
REFERENCE_PATH = (
    ROOT
    / "tmp"
    / "mandarin_a1_unit1_voxcpm2_audition"
    / "mandarin_demo_voice_reference.wav"
)
TONE_PROMPTS = [
    ("麻", "第二聲，音高由低往高。", "second tone, low to high"),
    ("馬", "第三聲，音高先降到低處，再升高。", "third tone, dip low then rise"),
]
REPEAT_GAP_SECONDS = 1.1
BETWEEN_TONES_SECONDS = 1.6


def synthesize(model: VoxCPM, text: str, sample_rate: int, **kwargs) -> np.ndarray:
    audio = model.generate(
        text=text,
        cfg_value=2.0,
        inference_timesteps=10,
        retry_badcase=True,
        retry_badcase_max_times=2,
        **kwargs,
    )
    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    if audio.size == 0 or not np.isfinite(audio).all():
        raise RuntimeError(f"VoxCPM2 returned invalid audio for {text!r}")
    return audio


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
    silence_repeat = np.zeros(round(sample_rate * REPEAT_GAP_SECONDS), dtype=np.float32)
    silence_between = np.zeros(round(sample_rate * BETWEEN_TONES_SECONDS), dtype=np.float32)

    audition_parts = []
    notes = [
        "VoxCPM2 第二、三聲修正版試聽",
        "試聽只保留目標單音節。合成時先以同一位普通話男聲說出聲調方向，再讓 VoxCPM2 接續生成目標字。",
        "每個音節播放一次，停 1.1 秒後重播相同音檔。",
        "順序：麻（第二聲），馬（第三聲）。",
        "",
    ]

    for index, (character, prompt_text, tone_label) in enumerate(TONE_PROMPTS):
        prompt_path = WORK_DIR / f"tone-{index + 2}-prompt.wav"
        prompt_audio = synthesize(
            model,
            prompt_text,
            sample_rate,
            reference_wav_path=str(REFERENCE_PATH),
        )
        sf.write(prompt_path, prompt_audio, sample_rate)

        target_audio = synthesize(
            model,
            character + "。",
            sample_rate,
            reference_wav_path=str(REFERENCE_PATH),
            prompt_wav_path=str(prompt_path),
            prompt_text=prompt_text,
        )
        target_path = WORK_DIR / f"tone-{index + 2}-target.wav"
        sf.write(target_path, target_audio, sample_rate)

        audition_parts.extend([target_audio, silence_repeat, target_audio])
        if index < len(TONE_PROMPTS) - 1:
            audition_parts.append(silence_between)
        print(
            f"Generated tone {index + 2} target ({tone_label}), "
            f"{len(target_audio) / sample_rate:.2f}s.",
            flush=True,
        )

    audition = np.concatenate(audition_parts)
    wav_path = OUTPUT_DIR / "mandarin-a1-unit1-voxcpm2-tone-audition-v2.wav"
    mp3_path = OUTPUT_DIR / "mandarin-a1-unit1-voxcpm2-tone-audition-v2.mp3"
    notes_path = OUTPUT_DIR / "mandarin-a1-unit1-voxcpm2-tone-audition-v2.txt"
    sf.write(wav_path, audition, sample_rate)
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
