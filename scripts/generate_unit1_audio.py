import os
import sys
import numpy as np
import torch
import soundfile as sf
from kokoro import KPipeline

OUT_DIR = os.path.abspath("tmp/kokoro_a1_unit1")
os.makedirs(OUT_DIR, exist_ok=True)

SAMPLE_RATE = 24000

print("Loading Kokoro pipeline for Chinese (lang_code='z')...")
pipeline_z = KPipeline(lang_code="z", repo_id="hexgrad/Kokoro-82M")

def silence(duration_sec=0.5):
    samples = int(SAMPLE_RATE * duration_sec)
    return np.zeros(samples, dtype=np.float32)

def synth_speech(text, voice="zf_xiaobei", speed=0.95):
    print(f"  [TTS] ({voice}, speed={speed}): {text}")
    chunks = []
    for _, _, audio in pipeline_z(text, voice=voice, speed=speed):
        if isinstance(audio, torch.Tensor):
            audio = audio.detach().cpu().numpy()
        chunks.append(audio)
    if not chunks:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(chunks)

# Define scenes with narration lines
SCENES = [
    {
        "id": "01_cover",
        "title": "單元封面與介紹",
        "narration": [
            ("zf_xiaobei", "歡迎來到克雷迅訓練中心華語 A1 課程。第一單元：發音與聲調。"),
        ],
        "pause_end": 1.0,
    },
    {
        "id": "02_objectives",
        "title": "單元學習重點",
        "narration": [
            ("zf_xiaobei", "本單元學習重點：注音與拼音、四個聲調與輕聲、變調規則，以及常用的課堂用語。"),
        ],
        "pause_end": 1.0,
    },
    {
        "id": "03_tones",
        "title": "四個基本聲調對比",
        "narration": [
            ("zf_xiaobei", "中文有四個基本聲調。請跟著老師練習。"),
            ("zf_xiaobei", "第一聲：媽，mā。高而平。"),
            ("zf_xiaobei", "第二聲：麻，má。往上揚。"),
            ("zf_xiaobei", "第三聲：馬，mǎ。先降後升。"),
            ("zf_xiaobei", "第四聲：罵，mà。短促下降。"),
            ("zf_xiaobei", "對比練習：媽、麻、馬、罵。"),
        ],
        "pause_end": 1.2,
    },
    {
        "id": "04_tone_sandhi",
        "title": "實用變調規則",
        "narration": [
            ("zf_xiaobei", "實用變調規則：兩個第三聲連讀時，第一個字變讀為第二聲，例如『你好』念作『ní hǎo』。"),
            ("zf_xiaobei", "『不』和『一』遇到第四聲時，變讀為第二聲，例如『不是』、『一次』。"),
        ],
        "pause_end": 1.2,
    },
    {
        "id": "05_vocab_basics",
        "title": "核心詞彙（人稱與基本字）",
        "narration": [
            ("zf_xiaobei", "核心詞彙，人稱與基本字：你。好。我。他。她。是。不。"),
        ],
        "pause_end": 1.0,
    },
    {
        "id": "06_vocab_courtesy",
        "title": "核心詞彙（禮貌與課堂用語）",
        "narration": [
            ("zf_xiaobei", "禮貌用語與課堂稱呼：謝謝。再見。對不起。不客氣。老師。同學。請問。"),
        ],
        "pause_end": 1.0,
    },
    {
        "id": "07_examples",
        "title": "課堂常用例句",
        "narration": [
            ("zf_xiaobei", "課堂常用例句：第一句：你好。"),
            ("zf_xiaobei", "第二句：謝謝。"),
            ("zf_xiaobei", "第三句：請再說一次。"),
            ("zf_xiaobei", "第四句：我不懂。"),
        ],
        "pause_end": 1.2,
    },
    {
        "id": "08_dialogue",
        "title": "實用情境對話演練",
        "narration": [
            ("zf_xiaobei", "情境對話演練。老師與學生王明的對話："),
            ("zf_xiaobei", "你好！"),
            ("zm_yunjian", "你好！"),
            ("zf_xiaobei", "請問，你叫什麼名字？"),
            ("zm_yunjian", "我叫王明。"),
            ("zf_xiaobei", "請再說一次。"),
            ("zm_yunjian", "王，明。"),
            ("zf_xiaobei", "謝謝。"),
            ("zm_yunjian", "不客氣。"),
        ],
        "pause_end": 1.2,
    },
    {
        "id": "09_conclusion",
        "title": "單元結語與複習",
        "narration": [
            ("zf_xiaobei", "恭喜完成第 1 單元！請在學習中心多加複習發音與例句。我們第 2 單元見！"),
        ],
        "pause_end": 1.5,
    },
]

scene_metadata = []
all_audios = []

for scene in SCENES:
    sid = scene["id"]
    print(f"\nProcessing Scene: {sid} - {scene['title']}")
    scene_audio_parts = []
    
    # Slight leading silence
    scene_audio_parts.append(silence(0.3))
    
    for voice, text in scene["narration"]:
        audio_chunk = synth_speech(text, voice=voice, speed=0.92)
        scene_audio_parts.append(audio_chunk)
        scene_audio_parts.append(silence(0.45))
        
    scene_audio_parts.append(silence(scene["pause_end"]))
    scene_audio = np.concatenate(scene_audio_parts)
    
    out_wav = os.path.join(OUT_DIR, f"{sid}.wav")
    sf.write(out_wav, scene_audio, SAMPLE_RATE)
    
    duration = len(scene_audio) / SAMPLE_RATE
    print(f"  Finished {sid}: duration = {duration:.2f}s, saved to {out_wav}")
    
    scene_metadata.append({
        "id": sid,
        "title": scene["title"],
        "duration": duration,
        "wav_path": out_wav
    })
    all_audios.append(scene_audio)

# Master combined audio
master_audio = np.concatenate(all_audios)
master_wav = os.path.join(OUT_DIR, "mandarin-a1-unit-1-master.wav")
sf.write(master_wav, master_audio, SAMPLE_RATE)
total_duration = len(master_audio) / SAMPLE_RATE
print(f"\nAll scenes processed! Total duration: {total_duration:.2f}s ({total_duration/60:.2f} min)")

# Save scene metadata json
import json
meta_path = os.path.join(OUT_DIR, "scenes.json")
with open(meta_path, "w", encoding="utf-8") as f:
    json.dump(scene_metadata, f, ensure_ascii=False, indent=2)
print(f"Scene metadata written to {meta_path}")
