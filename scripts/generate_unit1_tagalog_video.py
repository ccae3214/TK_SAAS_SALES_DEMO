import argparse
import gc
import json
import os
import re
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
WORK_DIR = ROOT / "tmp" / "mandarin_a1_unit1_tagalog_preview"
DEFAULT_SLIDES_DIR = WORK_DIR / "slides"
DEFAULT_OUTPUT_DIR = ROOT / "public" / "videos"
MODEL_ID = "openbmb/VoxCPM2"
SAMPLE_RATE = 24_000
REPEAT_GAP_SECONDS = 1.0
ITEM_GAP_SECONDS = 0.6
MANDARIN_TTS_SEEDS: dict[tuple[int, int], int] = {
    (3, 1): 20261128,
    (6, 1): 20261128,
}
VOICE_REFERENCE = (
    ROOT
    / "tmp"
    / "mandarin_a1_unit1_voxcpm2_audition"
    / "mandarin_demo_voice_reference.wav"
)
FILIPINO_VOICE_CONTROL = (
    "A clear, warm, natural female voice speaking Tagalog with a Filipino accent, "
    "like a patient Mandarin A1 teacher, at a moderate and steady pace."
)
FILIPINO_VOICE_REFERENCE_TEXT = (
    "Magandang araw. Ako ang inyong guro sa araling Mandarin. "
    "Makinig nang mabuti at ulitin ang bawat salita."
)
HIGHLIGHT_BOXES = {
    3: [(74, 232, 270, 360), (360, 232, 270, 360), (660, 232, 270, 360), (958, 232, 270, 360)],
    4: [(160, 176, 1040, 116), (160, 320, 1040, 126), (160, 535, 264, 72), (385, 535, 429, 72)],
    5: [
        (92, 230, 488, 80), (92, 331, 488, 80), (92, 432, 488, 80), (92, 533, 488, 80),
        (672, 230, 488, 80), (672, 331, 488, 80), (672, 432, 488, 80),
    ],
    6: [(90, 214 + 57 * index, 1090, 54) for index in range(7)],
    7: [(90, 230, 1090, 72), (90, 318, 1090, 76), (90, 410, 1090, 80), (90, 504, 1090, 80)],
    8: [
        (88, 208, 548, 96), (676, 208, 508, 96),
        (88, 310, 548, 100), (676, 310, 508, 100),
        (88, 416, 548, 100), (676, 416, 508, 100),
        (88, 522, 548, 118), (676, 522, 508, 118),
    ],
    9: [(96, 488, 140, 56), (246, 488, 250, 56), (508, 488, 172, 56)],
}


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
            {"text": "媽", "pinyin": "ma1"},
            {"text": "麻", "pinyin": "ma2"},
            {"text": "馬", "pinyin": "ma3"},
            {"text": "罵", "pinyin": "ma4"},
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
            {"text": "你好", "pinyin": "ni2 hao3"},
            {"text": "不是", "pinyin": "bu2 shi4"},
            {"text": "一次", "pinyin": "yi2 ci4"},
            {"text": "一天", "pinyin": "yi4 tian1"},
        ],
    },
    {
        "id": 5,
        "narration": (
            "Narito ang ilang batayang salita. Pakinggan nang mabuti ang pagbigkas. "
            "Pagkatapos ng bawat salita, may maikling paghinto bago ito ulitin."
        ),
        "mandarin": [
            {"text": "你", "pinyin": "ni3"},
            {"text": "好", "pinyin": "hao3"},
            {"text": "我", "pinyin": "wo3"},
            {"text": "他", "pinyin": "ta1"},
            {"text": "她", "pinyin": "ta1"},
            {"text": "是", "pinyin": "shi4"},
            {"text": "不", "pinyin": "bu4"},
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
            {"text": "謝謝", "pinyin": "xie4 xie5"},
            {"text": "再見", "pinyin": "zai4 jian4"},
            {"text": "對不起", "pinyin": "dui4 bu4 qi3"},
            {"text": "不客氣", "pinyin": "bu4 ke4 qi5"},
            {"text": "老師", "pinyin": "lao3 shi1"},
            {"text": "同學", "pinyin": "tong2 xue2"},
            {"text": "請問", "pinyin": "qing3 wen4"},
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
            {"text": "你好。", "pinyin": "ni2 hao3"},
            {"text": "謝謝。", "pinyin": "xie4 xie5"},
            {"text": "請再說一次。", "pinyin": "qing3 zai4 shuo1 yi2 ci4"},
            {"text": "我不懂。", "pinyin": "wo3 bu4 dong3"},
        ],
    },
    {
        "id": 8,
        "narration": (
            "Ngayon, magsanay tayo sa usapan sa klase. Pakinggan ang guro at si Wang Ming. "
            "Bawat linya sa Mandarin ay uulitin nang dalawang beses, na may malinaw na paghinto sa gitna."
        ),
        "mandarin": [
            {"text": "你好！", "pinyin": "ni2 hao3"},
            {"text": "你好！", "pinyin": "ni2 hao3"},
            {"text": "請問，你叫什麼名字？", "pinyin": "qing3 wen4 ni3 jiao4 shen2 me5 ming2 zi5"},
            {"text": "我叫王明。", "pinyin": "wo3 jiao4 wang2 ming2"},
            {"text": "請再說一次。", "pinyin": "qing3 zai4 shuo1 yi2 ci4"},
            {"text": "王，明。", "pinyin": "wang2 ming2"},
            {"text": "謝謝。", "pinyin": "xie4 xie5"},
            {"text": "不客氣。", "pinyin": "bu4 ke4 qi5"},
        ],
    },
    {
        "id": 9,
        "narration": (
            "Binabati kita sa pagtatapos ng unang yunit. Balikan ang mga tono, salita, at pangungusap. "
            "Sa susunod na yunit, pag-aaralan natin ang pagbati at pagpapakilala."
        ),
        "mandarin": [
            {"text": "你好", "pinyin": "ni2 hao3"},
            {"text": "請再說一次", "pinyin": "qing3 zai4 shuo1 yi2 ci4"},
            {"text": "我不懂", "pinyin": "wo3 bu4 dong3"},
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


def validate_mandarin_pinyin(item: dict[str, str]) -> None:
    pinyin = item["pinyin"]
    syllables = pinyin.split()
    if not syllables or any(not re.fullmatch(r"[a-z]+[1-5]", syllable) for syllable in syllables):
        raise ValueError(f"Invalid tone-numbered Pinyin for {item['text']!r}: {pinyin!r}")


def mandarin_tts_input(
    scene_id: int,
    index: int,
    item: dict[str, str],
) -> tuple[str, int | None]:
    validate_mandarin_pinyin(item)
    return item["pinyin"], MANDARIN_TTS_SEEDS.get((scene_id, index))


def repeat_chinese_practice(audio: np.ndarray) -> np.ndarray:
    return np.concatenate((audio, silence(REPEAT_GAP_SECONDS), audio))


def vtt_timestamp(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours = milliseconds // 3_600_000
    minutes = (milliseconds % 3_600_000) // 60_000
    whole_seconds = (milliseconds % 60_000) // 1000
    remainder = milliseconds % 1000
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d}.{remainder:03d}"


def highlight_filter(
    start: float,
    end: float,
    box: tuple[int, int, int, int],
) -> str:
    if start < 0 or end <= start:
        raise ValueError(f"Invalid highlight interval: {start}..{end}")
    x, y, width, height = box
    if x < 0 or y < 0 or width <= 0 or height <= 0 or x + width > 1280 or y + height > 720:
        raise ValueError(f"Highlight box is outside the 1280x720 slide: {box}")

    enable = f"between(t\\,{start:.6f}\\,{end:.6f})"
    return (
        f"drawbox=x={x}:y={y}:w={width}:h={height}:color=0xFFB703@0.20:t=fill:enable='{enable}',"
        f"drawbox=x={x}:y={y}:w={width}:h={height}:color=0xFFB703@0.95:t=4:enable='{enable}'"
    )


def run_ffmpeg(command: list[str], action: str) -> None:
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"{action} failed:\n{result.stderr[-3000:]}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slides-dir", type=Path, default=DEFAULT_SLIDES_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--reuse-tagalog-audio", action="store_true")
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

    filipino_narration: dict[int, np.ndarray] = {}
    if args.reuse_tagalog_audio:
        for scene in SCENES:
            audio_path = audio_dir / f"tagalog-slide-{scene['id']}.wav"
            if not audio_path.is_file():
                raise FileNotFoundError(f"Missing Tagalog narration WAV: {audio_path}")
            audio, sample_rate = sf.read(audio_path, dtype="float32")
            if audio.ndim != 1 or audio.size == 0 or not np.isfinite(audio).all():
                raise RuntimeError(f"Invalid Tagalog narration WAV: {audio_path}")
            filipino_narration[scene["id"]] = resample(audio, int(sample_rate))
            print(f"Reused Tagalog narration for slide {scene['id']}.", flush=True)
    else:
        os.environ["HF_HUB_OFFLINE"] = "1"
        print("Loading local VoxCPM2 model for Tagalog narration...", flush=True)
        from voxcpm import VoxCPM

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

        for scene in SCENES:
            audio = filipino_model.generate(
                text=f"({FILIPINO_VOICE_CONTROL}){scene['narration']}",
                reference_wav_path=str(reference_path),
                cfg_value=2.0,
                inference_timesteps=10,
            )
            if audio.size == 0 or not np.isfinite(audio).all():
                raise RuntimeError(
                    f"VoxCPM2 returned invalid Tagalog narration for slide {scene['id']}"
                )
            output_path = audio_dir / f"tagalog-slide-{scene['id']}.wav"
            sf.write(output_path, audio, sample_rate)
            filipino_narration[scene["id"]] = resample(audio, sample_rate)
            print(f"Generated Tagalog narration for slide {scene['id']}.", flush=True)

        del reference_audio, filipino_model
        gc.collect()

    print("Loading local MOSS-TTS Mandarin model...", flush=True)
    from moss_tts import MossTTS

    chinese_tts = MossTTS(VOICE_REFERENCE)
    mandarin_audio: dict[tuple[int, int], np.ndarray] = {}
    for scene in SCENES:
        for index, item in enumerate(scene["mandarin"]):
            tts_text, seed = mandarin_tts_input(scene["id"], index, item)
            audio = chinese_tts.synthesize(tts_text, seed=seed)
            mandarin_audio[(scene["id"], index)] = resample(
                audio, chinese_tts.sample_rate
            )
            print(
                f"Generated MOSS-TTS Mandarin sample slide {scene['id']} "
                f"line {index + 1} ({item['pinyin']}).",
                flush=True,
            )

    scene_metadata = []
    caption_cues = []
    master_parts = []
    scene_highlights: dict[int, list[tuple[float, float, tuple[int, int, int, int]]]] = {}
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
            boxes = HIGHLIGHT_BOXES.get(scene["id"], [])
            if len(boxes) != len(scene["mandarin"]):
                raise ValueError(
                    f"Expected one highlight box per Mandarin sample on slide {scene['id']}"
                )
            for index, item in enumerate(scene["mandarin"]):
                audio = mandarin_audio[(scene["id"], index)]
                cue_start = timeline + elapsed
                duration = len(audio) / SAMPLE_RATE
                practice_audio = repeat_chinese_practice(audio)
                practice_duration = len(practice_audio) / SAMPLE_RATE
                scene_highlights.setdefault(scene["id"], []).append(
                    (elapsed, elapsed + practice_duration, boxes[index])
                )
                parts.extend([practice_audio, silence(ITEM_GAP_SECONDS)])
                elapsed += practice_duration + ITEM_GAP_SECONDS
                caption_cues.append(
                    f"{vtt_timestamp(cue_start)} --> "
                    f"{vtt_timestamp(cue_start + practice_duration)}\n"
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
    vtt_path = output_dir / "mandarin-a1-unit-1-fil.vtt"
    vtt_path.write_text(
        "WEBVTT\n\n" + "\n\n".join(caption_cues) + "\n",
        encoding="utf-8",
    )

    mp4_path = output_dir / "mandarin-a1-unit-1-fil.mp4"
    mp3_path = output_dir / "mandarin-a1-unit-1-fil.mp3"
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
        scene = scene_metadata[index]
        video_filter = f"[{index}:v]setpts=PTS-STARTPTS,setsar=1"
        for start, end, box in scene_highlights.get(scene["id"], []):
            video_filter += "," + highlight_filter(start, end, box)
        filters.append(f"{video_filter}[{stream}]")
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
