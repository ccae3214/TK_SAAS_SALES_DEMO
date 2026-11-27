import argparse
import json
import os
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from kokoro import KPipeline
from voxcpm import VoxCPM

from audio_processing import slow_mandarin_audio


ROOT = Path(__file__).resolve().parents[1]
WORK_DIR = ROOT / "tmp" / "mandarin_a1_unit1_tagalog_preview"
DEFAULT_SLIDES_DIR = WORK_DIR / "slides"
DEFAULT_OUTPUT_DIR = ROOT / "deliverables"
MODEL_ID = "openbmb/VoxCPM2"
SAMPLE_RATE = 24_000
CHINESE_VOICE = "zm_yunjian"
CHINESE_TEACHER_VOICE = "zf_xiaobei"
FILIPINO_VOICE_CONTROL = (
    "A clear, warm, natural female voice speaking Tagalog with a Filipino accent, "
    "like a patient Mandarin A1 teacher, at a moderate and steady pace."
)
FILIPINO_VOICE_REFERENCE_TEXT = (
    "Magandang araw. Ako ang inyong guro sa araling Mandarin. "
    "Makinig nang mabuti at ulitin ang bawat salita."
)


SCENES = [
    {
        "id": 1,
        "narration": (
            "Maligayang pagdating sa unang aralin ng kursong Mandarin A1. "
            "Sa yunit na ito, pag-aaralan natin ang pagbigkas, mga tono, at mahahalagang salita para sa klase."
        ),
        "mandarin": [],
    },
    {
        "id": 2,
        "narration": (
            "Pagkatapos ng araling ito, makikilala mo ang Zhuyin at Pinyin, "
            "mabibigkas mo ang apat na pangunahing tono at ang neutral na tono, "
            "at magagamit mo ang ilang tuntunin sa pagbabago ng tono. "
            "Matututuhan mo rin ang mahahalagang salita at magagalang na pananalita sa klase."
        ),
        "mandarin": [],
    },
    {
        "id": 3,
        "narration": (
            "Sa Mandarin, nakaaapekto ang tono sa kahulugan ng isang pantig. "
            "Makinig sa apat na halimbawa. Ang unang tono ay mataas at pantay. "
            "Ang ikalawang tono ay pataas. Ang ikatlong tono ay bumababa at umaakyat. "
            "Ang ikaapat na tono ay mabilis na pababa. Makinig at ulitin ang bawat tunog."
        ),
        "mandarin": [
            {"text": "媽", "voice": "demo"},
            {"text": "麻", "voice": "demo"},
            {"text": "馬", "voice": "demo"},
            {"text": "罵", "voice": "demo"},
        ],
    },
    {
        "id": 4,
        "narration": (
            "May ilang tono na nagbabago kapag magkasunod ang mga pantig. "
            "Kapag magkasunod ang dalawang ikatlong tono, nagiging ikalawang tono ang una. "
            "Nagiging ikalawang tono ang bu bago ang ikaapat na tono. "
            "Nagbabago naman ang bigkas ng yi ayon sa kasunod na tono. "
            "Pakinggan ang bawat halimbawa at ulitin pagkatapos ng maikling paghinto."
        ),
        "mandarin": [
            {"text": "你好", "voice": "demo"},
            {"text": "不是", "voice": "demo"},
            {"text": "一次", "voice": "demo"},
            {"text": "一天", "voice": "demo"},
        ],
    },
    {
        "id": 5,
        "narration": (
            "Narito ang ilang batayang salita. Pakinggan nang mabuti ang pagbigkas. "
            "Pagkatapos ng bawat salita, may maikling paghinto bago ito ulitin."
        ),
        "mandarin": [
            {"text": "你", "voice": "demo"},
            {"text": "好", "voice": "demo"},
            {"text": "我", "voice": "demo"},
            {"text": "他", "voice": "demo"},
            {"text": "她", "voice": "demo"},
            {"text": "是", "voice": "demo"},
            {"text": "不", "voice": "demo"},
        ],
    },
    {
        "id": 6,
        "narration": (
            "Pag-aralan ang mga salitang ginagamit sa pagbibigay-galang at sa klase. "
            "Makinig sa malinaw na pagbigkas ng bawat salita, maghintay nang kaunti, "
            "at ulitin ito nang dahan-dahan."
        ),
        "mandarin": [
            {"text": "謝謝", "voice": "demo"},
            {"text": "再見", "voice": "demo"},
            {"text": "對不起", "voice": "demo"},
            {"text": "不客氣", "voice": "demo"},
            {"text": "老師", "voice": "demo"},
            {"text": "同學", "voice": "demo"},
            {"text": "請問", "voice": "demo"},
        ],
    },
    {
        "id": 7,
        "narration": (
            "Ito ang mga pangungusap na maaari mong gamitin sa klase. "
            "Kung hindi mo narinig, magalang na hilinging sabihin ito muli. "
            "Kung hindi mo naintindihan, sabihin ito nang tapat."
        ),
        "mandarin": [
            {"text": "你好。", "voice": "demo"},
            {"text": "謝謝。", "voice": "demo"},
            {"text": "請再說一次。", "voice": "demo"},
            {"text": "我不懂。", "voice": "demo"},
        ],
    },
    {
        "id": 8,
        "narration": (
            "Ngayon, magsanay tayo sa usapan sa klase. Pakinggan ang guro at si Wang Ming. "
            "Bawat linya sa Mandarin ay uulitin nang dalawang beses, na may malinaw na paghinto sa gitna."
        ),
        "mandarin": [
            {"text": "你好！", "voice": "teacher"},
            {"text": "你好！", "voice": "student"},
            {"text": "請問，你叫什麼名字？", "voice": "teacher"},
            {"text": "我叫王明。", "voice": "student"},
            {"text": "請再說一次。", "voice": "teacher"},
            {"text": "王，明。", "voice": "student"},
            {"text": "謝謝。", "voice": "teacher"},
            {"text": "不客氣。", "voice": "student"},
        ],
    },
    {
        "id": 9,
        "narration": (
            "Binabati kita sa pagtatapos ng unang yunit. Balikan ang mga tono, salita, at pangungusap. "
            "Sa susunod na yunit, pag-aaralan natin ang pagbati at pagpapakilala."
        ),
        "mandarin": [
            {"text": "你好", "voice": "demo"},
            {"text": "請再說一次", "voice": "demo"},
            {"text": "我不懂", "voice": "demo"},
        ],
    },
]


def silence(seconds: float) -> np.ndarray:
    return np.zeros(round(SAMPLE_RATE * seconds), dtype=np.float32)


def resample(audio: np.ndarray, source_rate: int) -> np.ndarray:
    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    if source_rate == SAMPLE_RATE:
        return audio
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-f", "f32le", "-ar", str(source_rate), "-ac", "1", "-i", "pipe:0",
        "-f", "f32le", "-ar", str(SAMPLE_RATE), "-ac", "1", "pipe:1",
    ]
    result = subprocess.run(command, input=audio.astype("<f4").tobytes(), capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace")[-2000:])
    if len(result.stdout) % 4:
        raise RuntimeError("FFmpeg returned an invalid PCM byte count while resampling")
    return np.frombuffer(result.stdout, dtype="<f4").copy()


def synthesize_chinese(pipeline: KPipeline, text: str, voice: str) -> np.ndarray:
    chunks = []
    for _, _, audio in pipeline(text, voice=voice, speed=0.98):
        if isinstance(audio, torch.Tensor):
            audio = audio.detach().cpu().numpy()
        chunks.append(np.asarray(audio, dtype=np.float32).reshape(-1))
    if not chunks:
        raise RuntimeError(f"Kokoro returned empty audio for {text!r}")
    audio = slow_mandarin_audio(np.concatenate(chunks), SAMPLE_RATE)
    if audio.size == 0 or not np.isfinite(audio).all():
        raise RuntimeError(f"Kokoro returned invalid Mandarin audio for {text!r}")
    return audio


def vtt_timestamp(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours = milliseconds // 3_600_000
    minutes = (milliseconds % 3_600_000) // 60_000
    whole_seconds = (milliseconds % 60_000) // 1000
    remainder = milliseconds % 1000
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d}.{remainder:03d}"


def run_ffmpeg(command: list[str], action: str) -> None:
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"{action} failed:\n{result.stderr[-3000:]}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slides-dir", type=Path, default=DEFAULT_SLIDES_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()

    slides_dir = args.slides_dir.resolve()
    output_dir = args.output_dir.resolve()
    audio_dir = WORK_DIR / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    for scene in SCENES:
        slide_path = slides_dir / f"slide-{scene['id']}.png"
        if not slide_path.is_file():
            raise FileNotFoundError(f"Missing slide image from the reviewed deck: {slide_path}")

    os.environ["HF_HUB_OFFLINE"] = "1"
    print("Loading local VoxCPM2 model for Tagalog narration...", flush=True)
    filipino_model = VoxCPM.from_pretrained(
        MODEL_ID,
        load_denoiser=False,
        local_files_only=True,
        optimize=False,
        device="cpu",
    )
    sample_rate = int(filipino_model.tts_model.sample_rate)

    reference_path = audio_dir / "tagalog_teacher_reference.wav"
    reference_audio = filipino_model.generate(
        text=f"({FILIPINO_VOICE_CONTROL}){FILIPINO_VOICE_REFERENCE_TEXT}",
        cfg_value=2.0,
        inference_timesteps=10,
    )
    if reference_audio.size == 0 or not np.isfinite(reference_audio).all():
        raise RuntimeError("VoxCPM2 returned an invalid Tagalog voice reference")
    sf.write(reference_path, reference_audio, sample_rate)
    print("Created a single Tagalog teacher voice reference.", flush=True)

    filipino_narration: dict[int, np.ndarray] = {}
    for scene in SCENES:
        audio = filipino_model.generate(
            text=f"({FILIPINO_VOICE_CONTROL}){scene['narration']}",
            reference_wav_path=str(reference_path),
            cfg_value=2.0,
            inference_timesteps=10,
        )
        if audio.size == 0 or not np.isfinite(audio).all():
            raise RuntimeError(f"VoxCPM2 returned invalid Tagalog narration for slide {scene['id']}")
        output_path = audio_dir / f"tagalog-slide-{scene['id']}.wav"
        sf.write(output_path, audio, sample_rate)
        filipino_narration[scene["id"]] = resample(audio, sample_rate)
        print(f"Generated Tagalog narration for slide {scene['id']}.", flush=True)

    print("Loading local Kokoro Mandarin voices...", flush=True)
    chinese_pipeline = KPipeline(lang_code="z", repo_id="hexgrad/Kokoro-82M", device="cpu")
    mandarin_audio: dict[tuple[int, int], np.ndarray] = {}
    for scene in SCENES:
        for index, item in enumerate(scene["mandarin"]):
            voice = {
                "demo": CHINESE_VOICE,
                "teacher": CHINESE_TEACHER_VOICE,
                "student": CHINESE_VOICE,
            }[item["voice"]]
            mandarin_audio[(scene["id"], index)] = synthesize_chinese(
                chinese_pipeline, item["text"], voice
            )
            print(
                f"Generated Mandarin sample slide {scene['id']} line {index + 1} "
                f"({item['voice']}).",
                flush=True,
            )

    scene_metadata = []
    caption_cues = []
    master_parts = []
    timeline = 0.0
    for scene in SCENES:
        parts = [silence(0.25), filipino_narration[scene["id"]]]
        narration_duration = len(filipino_narration[scene["id"]]) / SAMPLE_RATE
        caption_cues.append(
            f"{vtt_timestamp(timeline + 0.25)} --> "
            f"{vtt_timestamp(timeline + 0.25 + narration_duration)}\n"
            f"{scene['narration']}"
        )
        elapsed = 0.25 + narration_duration
        if scene["mandarin"]:
            parts.append(silence(0.65))
            elapsed += 0.65
            for index, item in enumerate(scene["mandarin"]):
                audio = mandarin_audio[(scene["id"], index)]
                cue_start = timeline + elapsed
                duration = len(audio) / SAMPLE_RATE
                parts.extend([audio, silence(1.1), audio, silence(0.95)])
                elapsed += duration * 2 + 1.1 + 0.95
                caption_cues.append(
                    f"{vtt_timestamp(cue_start)} --> {vtt_timestamp(timeline + elapsed)}\n"
                    f"{item['text']}"
                )
        else:
            parts.append(silence(1.2))
            elapsed += 1.2

        scene_audio = np.concatenate(parts)
        scene_duration = len(scene_audio) / SAMPLE_RATE
        wav_path = WORK_DIR / f"slide-{scene['id']}-mix.wav"
        sf.write(wav_path, scene_audio, SAMPLE_RATE)
        scene_metadata.append(
            {
                "id": scene["id"],
                "duration": scene_duration,
                "narrationDuration": narration_duration,
                "slide_path": str(slides_dir / f"slide-{scene['id']}.png"),
                "wav_path": str(wav_path),
            }
        )
        master_parts.append(scene_audio)
        timeline += scene_duration
        print(f"Prepared slide {scene['id']} audio ({scene_duration:.1f}s).", flush=True)

    master_audio = np.concatenate(master_parts)
    master_path = WORK_DIR / "mandarin-a1-unit1-tagalog-master.wav"
    sf.write(master_path, master_audio, SAMPLE_RATE)
    scenes_path = WORK_DIR / "scenes.json"
    scenes_path.write_text(json.dumps(scene_metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    vtt_path = output_dir / "mandarin-a1-unit1-tagalog-preview.vtt"
    vtt_path.write_text(
        "WEBVTT\n\n" + "\n\n".join(caption_cues) + "\n",
        encoding="utf-8",
    )

    mp4_path = output_dir / "mandarin-a1-unit1-tagalog-preview.mp4"
    mp3_path = output_dir / "mandarin-a1-unit1-tagalog-preview.mp3"
    video_command = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    for index, scene in enumerate(scene_metadata):
        video_command.extend(
            [
                "-loop", "1", "-framerate", "30", "-t", f"{scene['duration']:.6f}",
                "-i", scene["slide_path"],
            ]
        )
    video_command.extend(["-i", str(master_path)])
    streams = []
    filters = []
    for index in range(len(scene_metadata)):
        stream = f"slide{index}"
        streams.append(f"[{stream}]")
        filters.append(f"[{index}:v]setpts=PTS-STARTPTS,setsar=1[{stream}]")
    filters.append(f"{''.join(streams)}concat=n={len(scene_metadata)}:v=1:a=0[outv]")
    total_duration = sum(scene["duration"] for scene in scene_metadata)
    video_command.extend(
        [
            "-filter_complex", ";".join(filters),
            "-map", "[outv]", "-map", f"{len(scene_metadata)}:a:0",
            "-c:v", "libx264", "-preset", "fast", "-tune", "stillimage",
            "-r", "30", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-pix_fmt", "yuv420p", "-t", f"{total_duration:.6f}", str(mp4_path),
        ]
    )
    run_ffmpeg(video_command, "Encoding Tagalog Mandarin A1 video")
    run_ffmpeg(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(master_path), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-c:a", "libmp3lame", "-qscale:a", "2", "-ar", "48000", str(mp3_path),
        ],
        "Encoding standalone Tagalog Mandarin A1 audio",
    )
    print(f"Created {mp4_path}", flush=True)
    print(f"Created {mp3_path}", flush=True)
    print(f"Created {vtt_path}", flush=True)


if __name__ == "__main__":
    main()
