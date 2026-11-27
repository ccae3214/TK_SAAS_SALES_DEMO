import subprocess

import numpy as np


def slow_mandarin_audio(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "f32le",
        "-ar",
        str(sample_rate),
        "-ac",
        "1",
        "-i",
        "pipe:0",
        "-af",
        "atempo=0.8",
        "-f",
        "f32le",
        "-ar",
        str(sample_rate),
        "-ac",
        "1",
        "pipe:1",
    ]
    result = subprocess.run(
        command,
        input=np.asarray(audio, dtype="<f4").tobytes(),
        capture_output=True,
    )
    if result.returncode:
        detail = result.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"Slowing Mandarin audio failed:\n{detail[-2000:]}")
    if len(result.stdout) % 4:
        raise RuntimeError("FFmpeg returned an invalid Mandarin PCM byte count")
    return np.frombuffer(result.stdout, dtype="<f4").copy()
