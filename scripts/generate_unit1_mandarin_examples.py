import os
import numpy as np
import soundfile as sf
os.environ["HF_HUB_OFFLINE"] = "1"

import torch
from kokoro import KPipeline

OUTPUT_DIR = os.path.abspath("tmp/kokoro_a1_unit1_filipino/mandarin_samples")
os.makedirs(OUTPUT_DIR, exist_ok=True)

VOICE = "zm_yunjian"
WORD_PAUSE_SECONDS = 0.65
ITEM_PAUSE_SECONDS = 0.45

WORD_LISTS = {
    "03_tones": [
        "媽媽",
        "麻煩",
        "馬路",
        "罵人",
    ],
    "04_tone_sandhi": [
        "你好",
        "不是",
        "一次",
    ],
    "05_vocab_basics": [
        "你",
        "好",
        "我",
        "他",
        "她",
        "是",
        "不",
    ],
    "06_vocab_courtesy": [
        "謝謝",
        "再見",
        "對不起",
        "不客氣",
        "老師",
        "同學",
        "請問",
    ],
}

SAMPLES = {
    "07_examples": [
        "你好。謝謝。請再說一次。我不懂。",
    ],
    "08_dialogue": [
        "你好！",
        "你好！",
        "請問，你叫什麼名字？",
        "我叫王明。",
        "請再說一次。",
        "王，明。",
        "謝謝。",
        "不客氣。",
    ],
}

pipeline = KPipeline(lang_code="z", repo_id="hexgrad/Kokoro-82M", device="cpu")
sample_rate = 24000


def silence(seconds):
    return np.zeros(int(sample_rate * seconds), dtype=np.float32)


def synthesize(text):
    chunks = []
    for _, _, audio in pipeline(text, voice=VOICE, speed=1.0):
        if isinstance(audio, torch.Tensor):
            audio = audio.detach().cpu().numpy()
        chunks.append(np.asarray(audio, dtype=np.float32))
    if not chunks:
        raise RuntimeError(f"Kokoro returned empty audio for {text!r}")
    audio = np.concatenate(chunks)
    if audio.size == 0 or not np.isfinite(audio).all():
        raise RuntimeError(f"Kokoro returned invalid audio for {text!r}")
    return audio


for scene_id, items in {**WORD_LISTS, **SAMPLES}.items():
    parts = [silence(0.25)]
    if scene_id in WORD_LISTS:
        for word in items:
            word_audio = synthesize(f"{word}。")
            parts.extend(
                [
                    word_audio,
                    silence(WORD_PAUSE_SECONDS),
                    word_audio,
                    silence(ITEM_PAUSE_SECONDS),
                ]
            )
    else:
        for text in items:
            parts.append(synthesize(text))
            parts.append(silence(ITEM_PAUSE_SECONDS))
    audio = np.concatenate(parts)
    output_path = os.path.join(OUTPUT_DIR, f"{scene_id}.wav")
    sf.write(output_path, audio, sample_rate)
    print(f"Generated Kokoro male Mandarin pronunciation sample {scene_id}")
