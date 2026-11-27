import argparse
import json
import os
import re
import subprocess
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from voxcpm import VoxCPM
from audio_processing import slow_mandarin_audio


ROOT = Path(__file__).resolve().parents[1]
SAMPLE_RATE = 24_000
VOICE_CONTROL = (
    "A clear, warm, natural female voice speaking Tagalog, "
    "like a patient Mandarin language teacher at a moderate pace."
)
MANDARIN_VOICE_CONTROLS = {
    "zf_xiaobei": (
        "A clear, warm, natural female voice speaking Mandarin Chinese "
        "slowly and clearly, with each syllable distinctly articulated."
    ),
    "zm_yunjian": (
        "A clear, warm, natural male voice speaking Mandarin Chinese "
        "slowly and clearly, with each syllable distinctly articulated."
    ),
}

UNIT_TITLES_TL = {
    2: "Pagbati, Paggalang at Pagpapakilala",
    3: "Mga Numero, Oras at Petsa",
    4: "Paliparan, Ahensya at mga Dokumento",
    5: "Tirahan at Paghihiwalay ng Basura",
    6: "Pagkain at Convenience Store",
    7: "Transportasyon at Pagtatanong ng Direksiyon",
    8: "Pamimili, Pera at Pagpapadala ng Pera",
    9: "Shift sa Trabaho at Pag-unawa sa Utos",
    10: "Kaligtasan sa Trabaho at mga Babala",
    11: "Sahod, Overtime, Leave at Day Off",
    12: "Pag-aalaga 1: Paggising, Pagkain at Gamot",
    13: "Pag-aalaga 2: Pagpapaligo, Pagbabanyo, Pagbaling at Blood Pressure",
    14: "Gawaing-bahay: Paglilinis, Paglalaba, Pagluluto at Pag-aalaga ng Bata",
    15: "Pabrika: Makina, Production Line at Quality Control",
    16: "Pagsasaka: Bukid, Greenhouse at Pag-aani",
    17: "Masama ang Pakiramdam at Pagpapatingin sa Doktor",
    18: "Telepono, Internet, Panahon at Pamilya",
    19: "Emergency, Paghingi ng Tulong at Karapatan ng Manggagawa",
    20: "Pagbabalik-aral at Pagsasanay na Pagsusulit",
}

UNIT_TOPICS_TL = {
    2: "pagbati, magagalang na pananalita, pagpapakilala ng pangalan, nasyonalidad at trabaho, at pagtawag sa pamilya ng amo",
    3: "mga numero at numero ng telepono, pagsasabi ng oras, araw at petsa, at pag-aayos ng oras ng pagkikita",
    4: "paghahanap ng ahente sa paliparan, pasaporte, ARC at iba pang dokumento, at paghingi ng tulong kapag may nawala",
    5: "mga gamit sa kuwarto at dormitoryo, pag-report ng sira, paghihiwalay ng basura at mga patakaran sa dorm",
    6: "pag-order sa convenience store at kainan, pagsasabi ng hindi kinakain, take-out at pag-iinit ng pagkain",
    7: "pagsakay sa bus, MRT at tren, paggamit ng EasyCard, at pagtatanong at pag-unawa ng direksiyon",
    8: "pagtatanong ng presyo, pagtawad at pagbabayad, paggamit ng ATM at pagpapadala ng pera sa Pilipinas",
    9: "oras ng pasok at shift, pag-unawa at pagsagot sa simpleng utos, at paghiling na ulitin ang hindi naintindihan",
    10: "mga babala sa trabaho, protective gear, at paghingi ng tulong at pag-report kapag may nasaktan o may sunog",
    11: "payslip, overtime pay at mga kaltas, paghingi ng leave at pagsasabi ng day off",
    12: "paggising at pag-alalay sa matanda, pagsisipilyo at paghihilamos, pagpapakain at pagpapainom ng gamot",
    13: "pagpapaligo, pagpapalit ng diaper, pagbabanyo, pagbaling, pagsukat ng blood pressure at temperatura, at pag-report sa pamilya",
    14: "paglilinis, paglalaba, pagluluto, pag-aalaga at paghahatid-sundo ng bata",
    15: "mga makina at production line, pag-report ng sira at depektibong produkto, pag-iimpake at paglalagay ng label",
    16: "trabaho sa bukid, greenhouse at manukan, pagdidilig, paglalagay ng pataba, pag-aani at pag-iingat sa init at pesticide",
    17: "pagsasabi kung saan masakit, pagpapa-register sa klinika, pag-unawa sa paraan ng pag-inom ng gamot at allergy",
    18: "pag-charge ng telepono, Wi-Fi, video call sa pamilya, at pag-unawa sa balita tungkol sa panahon at bagyo",
    19: "pagtawag sa 119 at 110, pagsasabi ng address at nangyari, at paghingi ng tulong sa 1955 labor hotline",
    20: "pagbabalik-aral sa lahat ng yunit, pakikinig, pagbasa, pagsasalita at roleplay",
}

SCENE_FOCUS_TL = {
    (2, "03_greetings"): "mga pagbati at magagalang na pananalita",
    (2, "04_names"): "mga pangalan at pagpapakilala sa sarili",
    (2, "05_nationalities"): "nasyonalidad at mga pangalan ng bansa",
    (2, "06_jobs"): "mga trabaho at hanapbuhay",
    (2, "07_grammar"): "pagsasabi at pagtatanong tungkol sa pangalan, nasyonalidad at trabaho",
    (3, "03_numbers"): "mga numero at numero ng telepono",
    (3, "04_dates"): "mga taon, buwan, petsa at araw ng linggo",
    (3, "05_time"): "pagsasabi ng oras at pag-aayos ng pagkikita",
    (3, "06_grammar"): "pagtatanong kung ilan o magkano at tamang paggamit ng mga bilang",
}

UNIT_2_VOCABULARY_GROUPS = {
    "03_greetings": ("hello", "good morning", "good night", "welcome", "please", "you are welcome", "it is okay"),
    "04_names": ("name", "surname", "what", "who", "to be called", "called"),
    "05_nationalities": ("taiwan", "china", "united states", "japan", "united kingdom", "country"),
    "06_jobs": ("student", "doctor", "job", "work", "teacher", "friend"),
}
UNIT_3_VOCABULARY_GROUPS = {
    "03_numbers": ("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "hundred", "thousand", "how many", "how much", "number"),
    "04_dates": ("year", "month", "day of the month", "week", "sunday", "weekend", "today", "tomorrow", "yesterday", "birthday", "years old", "this year"),
    "05_time": ("when", "now", "morning", "afternoon", "evening", "o'clock", "minute", "half", "telephone"),
}


def parse_sql_row(line):
    index = line.index("(") + 1

    def skip_delimiters():
        nonlocal index
        while index < len(line) and (line[index].isspace() or line[index] == ","):
            index += 1

    def read_integer():
        nonlocal index
        skip_delimiters()
        end = index
        while end < len(line) and line[end].isdigit():
            end += 1
        value = int(line[index:end])
        index = end
        return value

    def read_text():
        nonlocal index
        skip_delimiters()
        if line[index] == "E":
            index += 1
        if line[index] != "'":
            raise ValueError(f"Expected SQL string in seed row: {line[:40]}")
        index += 1
        value = []
        while index < len(line):
            char = line[index]
            index += 1
            if char == "'":
                if index < len(line) and line[index] == "'":
                    value.append("'")
                    index += 1
                else:
                    break
            elif char == "\\" and index < len(line):
                escaped = line[index]
                index += 1
                value.append({"n": "\n", "r": "\r", "t": "\t"}.get(escaped, escaped))
            else:
                value.append(char)
        return "".join(value)

    position = read_integer()
    name = read_text()
    name_en = read_text()
    hours = read_integer()
    topics = read_text()
    topics_en = read_text()
    examples = read_text()
    vocabulary = read_text()
    dialogue = read_text()
    category = read_text()
    category_en = read_text()
    return {
        "position": position,
        "name": name,
        "name_en": name_en,
        "hours": hours,
        "topics": topics,
        "topics_en": topics_en,
        "examples": examples,
        "vocabulary": vocabulary,
        "dialogue": dialogue,
        "category": category,
        "category_en": category_en,
    }


def load_units():
    sql = (ROOT / "scripts" / "seed-mandarin-a1-course.sql").read_text(encoding="utf-8")
    rows = [
        parse_sql_row(line)
        for line in sql.splitlines()
        if re.match(r"\s*\(\d+,\s*E'", line)
    ]
    units = {row["position"]: row for row in rows}
    if set(units) != set(range(1, 21)):
        raise RuntimeError(f"Expected A1 units 1-20, found positions {sorted(units)}")
    return units


def parse_content_lines(text):
    lines = []
    for line in text.splitlines():
        columns = [column.strip() for column in line.split("|")]
        if columns and columns[0]:
            lines.append(columns)
    return lines


def unit_scenes(position):
    source_dir = ROOT / "tmp" / f"kokoro_a1_unit{position}"
    scenes_path = source_dir / "scenes.json"
    if not scenes_path.is_file():
        raise FileNotFoundError(f"Missing scene metadata: {scenes_path}")
    scenes = json.loads(scenes_path.read_text(encoding="utf-8"))
    for scene in scenes:
        image_path = source_dir / f"{scene['id']}.png"
        if not image_path.is_file():
            raise FileNotFoundError(f"Missing lesson slide: {image_path}")
        scene["slide_path"] = str(image_path)
    return source_dir, scenes


def scene_kind(position, scene_id):
    if scene_id.startswith("01_"):
        return "cover"
    if scene_id.startswith("02_"):
        return "objectives"
    if (
        position == 2 and scene_id in UNIT_2_VOCABULARY_GROUPS
        or position == 3 and scene_id in UNIT_3_VOCABULARY_GROUPS
    ):
        return "vocabulary"
    if "dialogue" in scene_id:
        return "dialogue"
    if "summary" in scene_id or "conclusion" in scene_id:
        return "summary"
    if "speaking" in scene_id or "practice" in scene_id:
        return "practice"
    if "example" in scene_id:
        return "examples"
    if "grammar" in scene_id or "pattern" in scene_id:
        return "patterns"
    if "vocabulary" in scene_id:
        return "vocabulary"
    return "examples"


def narration_for_scene(unit, scene_id):
    position = unit["position"]
    title = UNIT_TITLES_TL[position]
    topic = UNIT_TOPICS_TL[position]
    focus = SCENE_FOCUS_TL.get((position, scene_id), topic)
    kind = scene_kind(position, scene_id)
    if kind == "cover":
        return (
            f"Maligayang pagdating sa Yunit {position}: {title}. "
            f"Sa araling ito, pag-aaralan natin ang {topic}."
        )
    if kind == "objectives":
        return (
            f"Sa yunit na ito, matututuhan mo ang {topic}. "
            "Pakinggan ang mga halimbawa at ulitin ang mga pangungusap sa Mandarin."
        )
    if kind == "vocabulary":
        return (
            f"Pag-aralan natin ang {focus}. Pakinggan ang bigkas ng mga salitang Mandarin, "
            "basahin ang kahulugan at pinyin sa slide, at ulitin pagkatapos ng guro."
        )
    if kind == "patterns":
        return (
            f"Pag-aralan natin ang mga pangungusap tungkol sa {focus}. "
            "Pansinin ang ayos ng mga salita at subukang bumuo ng sarili mong pangungusap."
        )
    if kind == "practice":
        return (
            "Magsanay na magsalita. Pakinggan ang pangungusap sa Mandarin, ulitin nang malakas, "
            "at subukang sabihin ito nang hindi tumitingin sa pinyin."
        )
    if kind == "dialogue":
        return (
            f"Makinig sa usapan tungkol sa {topic}. Pansinin kung paano ginagamit ang mga salita, "
            "pagkatapos ay magsanay sa dalawang papel kasama ang kapareha."
        )
    if kind == "summary":
        return (
            f"Sa yunit na ito, pinag-aralan natin ang {topic}. Balikan ang bokabularyo, "
            "mga pangungusap at usapan; gamitin ang natutuhan sa pang-araw-araw na buhay."
        )
    return (
        f"Pakinggan ang mga halimbawang pangungusap tungkol sa {topic}. "
        "Bigyang-pansin ang tono at gamit ng mga salita, saka ulitin pagkatapos ng guro."
    )


def parse_vocab(unit):
    entries = []
    for columns in parse_content_lines(unit["vocabulary"]):
        if len(columns) >= 3:
            entries.append({"word": columns[0], "pinyin": columns[1], "meaning": columns[2]})
    return entries


def parse_phrases(text):
    phrases = []
    for columns in parse_content_lines(text):
        phrase = re.sub(r"^[A-ZＡ-Ｚ]\s*[:：]\s*", "", columns[0]).strip()
        if phrase:
            phrases.append(phrase)
    return phrases


def parse_dialogue(text):
    lines = []
    for columns in parse_content_lines(text):
        raw = columns[0]
        match = re.match(r"^([A-ZＡ-Ｚ])\s*[:：]\s*(.*)$", raw)
        if match:
            speaker, phrase = match.groups()
            voice = "zf_xiaobei" if speaker.upper() in ("A", "Ａ") else "zm_yunjian"
        else:
            phrase = raw
            voice = "zf_xiaobei"
        if phrase.strip():
            lines.append((voice, phrase.strip()))
    return lines


def assign_vocabulary_groups(position, scenes, entries):
    vocab_scene_ids = [
        scene["id"]
        for scene in scenes
        if scene_kind(position, scene["id"]) == "vocabulary"
    ]
    groups = {scene_id: [] for scene_id in vocab_scene_ids}
    if position == 2:
        rules = UNIT_2_VOCABULARY_GROUPS
    elif position == 3:
        rules = UNIT_3_VOCABULARY_GROUPS
    else:
        chunk_size = max(1, (len(entries) + len(vocab_scene_ids) - 1) // len(vocab_scene_ids))
        for index, scene_id in enumerate(vocab_scene_ids):
            groups[scene_id] = entries[index * chunk_size : (index + 1) * chunk_size]
        return groups

    remaining = []
    for entry in entries:
        search_text = f"{entry['word']} {entry['meaning']}".lower()
        matched = False
        for scene_id in vocab_scene_ids:
            keywords = rules.get(scene_id, ())
            if any(keyword in search_text for keyword in keywords):
                groups[scene_id].append(entry)
                matched = True
                break
        if not matched:
            remaining.append(entry)
    for index, entry in enumerate(remaining):
        if vocab_scene_ids:
            groups[vocab_scene_ids[index % len(vocab_scene_ids)]].append(entry)
    return groups


def mandarin_sample_for_scene(unit, scene, vocab_groups, examples, dialogue):
    position = unit["position"]
    scene_id = scene["id"]
    kind = scene_kind(position, scene_id)
    if kind == "vocabulary":
        return [("zf_xiaobei", entry["word"]) for entry in vocab_groups.get(scene_id, [])]
    if kind == "dialogue":
        return dialogue
    if kind in ("examples", "patterns", "practice"):
        limit = 5 if kind == "examples" else 3
        return [("zf_xiaobei", phrase) for phrase in examples[:limit]]
    return []


def combine_mandarin_sample_lines(lines, kind):
    if kind not in ("vocabulary", "examples", "patterns", "practice"):
        return lines

    separator = "、" if kind == "vocabulary" else "。"
    grouped = []
    for voice, phrase in lines:
        if grouped and grouped[-1][0] == voice:
            grouped[-1][1].append(phrase)
        else:
            grouped.append((voice, [phrase]))

    combined = []
    for voice, phrases in grouped:
        text = separator.join(
            phrase.rstrip("，、。！？；; ") for phrase in phrases
        ).rstrip("，、。！？；; ")
        combined.append((voice, f"{text}。"))
    return combined


def synthesize_voxcpm(model, text, voice_control):
    audio = model.generate(
        text=f"({voice_control}){text}",
        cfg_value=2.0,
        inference_timesteps=10,
    )
    if audio.size == 0 or not np.isfinite(audio).all():
        raise RuntimeError(f"VoxCPM returned invalid audio for {text!r}")
    return resample_voice(audio, model.tts_model.sample_rate)


def write_mandarin_samples(units, position, model):
    unit = units[position]
    _, scenes = unit_scenes(position)
    output_dir = ROOT / "tmp" / f"kokoro_a1_unit{position}_filipino" / "mandarin_samples"
    output_dir.mkdir(parents=True, exist_ok=True)
    vocab_groups = assign_vocabulary_groups(position, scenes, parse_vocab(unit))
    examples = parse_phrases(unit["examples"])
    dialogue = parse_dialogue(unit["dialogue"])
    for scene in scenes:
        sample_lines = mandarin_sample_for_scene(unit, scene, vocab_groups, examples, dialogue)
        if not sample_lines:
            continue
        sample_lines = combine_mandarin_sample_lines(
            sample_lines,
            scene_kind(position, scene["id"]),
        )
        audio_parts = [np.zeros(int(SAMPLE_RATE * 0.25), dtype=np.float32)]
        for voice, phrase in sample_lines:
            voice_control = MANDARIN_VOICE_CONTROLS[voice]
            audio_parts.append(synthesize_voxcpm(model, phrase, voice_control))
            audio_parts.append(np.zeros(int(SAMPLE_RATE * 0.3), dtype=np.float32))
        output_path = output_dir / f"{scene['id']}.wav"
        audio = slow_mandarin_audio(np.concatenate(audio_parts), SAMPLE_RATE)
        sf.write(output_path, audio, SAMPLE_RATE)
        print(f"VoxCPM2 Mandarin examples ready: unit {position}, {scene['id']}")


def resample_voice(audio, source_rate):
    if source_rate == SAMPLE_RATE:
        return audio.astype(np.float32, copy=False)
    from math import gcd

    divisor = gcd(source_rate, SAMPLE_RATE)
    return resample_poly(
        audio,
        SAMPLE_RATE // divisor,
        source_rate // divisor,
    ).astype(np.float32)


def to_vtt_timestamp(seconds):
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds_part, milliseconds = divmod(remainder, 1000)
    return (
        f"{hours:02d}:{minutes:02d}:{seconds_part:02d}."
        f"{milliseconds:03d}"
    )


def run_ffmpeg(command, action):
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"{action} failed:\n{result.stderr[-2000:]}")


def build_video(position, scenes, output_dir):
    public_dir = ROOT / "public" / "videos"
    public_dir.mkdir(parents=True, exist_ok=True)
    mp4_path = public_dir / f"mandarin-a1-unit-{position}-fil.mp4"
    mp3_path = public_dir / f"mandarin-a1-unit-{position}-fil.mp3"
    vtt_path = public_dir / f"mandarin-a1-unit-{position}-fil.vtt"
    master_wav = output_dir / f"mandarin-a1-unit-{position}-fil-master.wav"
    total_duration = sum(scene["duration"] for scene in scenes)

    video_command = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    for scene in scenes:
        video_command.extend([
            "-loop", "1",
            "-framerate", "30",
            "-t", f"{scene['duration']:.6f}",
            "-i", scene["slide_path"],
        ])
    video_command.extend(["-i", str(master_wav)])
    video_streams = []
    filters = []
    for index in range(len(scenes)):
        stream = f"slide{index}"
        video_streams.append(f"[{stream}]")
        filters.append(f"[{index}:v]setpts=PTS-STARTPTS,setsar=1[{stream}]")
    filters.append(
        f"{''.join(video_streams)}concat=n={len(scenes)}:v=1:a=0[outv]"
    )
    video_command.extend([
        "-filter_complex", ";".join(filters),
        "-map", "[outv]",
        "-map", f"{len(scenes)}:a:0",
        "-c:v", "libx264",
        "-preset", "fast",
        "-tune", "stillimage",
        "-r", "30",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-t", f"{total_duration:.6f}",
        str(mp4_path),
    ])
    run_ffmpeg(video_command, f"Encoding Filipino unit {position} video")
    run_ffmpeg([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(master_wav),
        "-c:a", "libmp3lame", "-qscale:a", "2",
        str(mp3_path),
    ], f"Encoding Filipino unit {position} audio")
    (output_dir / f"mandarin-a1-unit-{position}-fil.vtt").replace(vtt_path)
    print(f"Built unit {position}: {mp4_path.name}, {mp3_path.name}, {vtt_path.name}")


def generate_unit(position, unit, model):
    source_dir, source_scenes = unit_scenes(position)
    output_dir = ROOT / "tmp" / f"kokoro_a1_unit{position}_filipino"
    voice_dir = output_dir / "filipino_voice"
    sample_dir = output_dir / "mandarin_samples"
    output_dir.mkdir(parents=True, exist_ok=True)
    voice_dir.mkdir(parents=True, exist_ok=True)
    sample_dir.mkdir(parents=True, exist_ok=True)
    vocab_groups = assign_vocabulary_groups(position, source_scenes, parse_vocab(unit))
    examples = parse_phrases(unit["examples"])
    dialogue = parse_dialogue(unit["dialogue"])

    metadata = []
    caption_cues = []
    all_audio_parts = []
    timeline_offset = 0.0
    for scene in source_scenes:
        scene_id = scene["id"]
        narration = narration_for_scene(unit, scene_id)
        voice_audio = synthesize_voxcpm(model, narration, VOICE_CONTROL)
        voice_path = voice_dir / f"{scene_id}.wav"
        sf.write(voice_path, voice_audio, SAMPLE_RATE)

        parts = [voice_audio]
        sample_lines = mandarin_sample_for_scene(unit, scene, vocab_groups, examples, dialogue)
        sample_path = sample_dir / f"{scene_id}.wav"
        narration_duration = len(voice_audio) / SAMPLE_RATE
        if sample_lines:
            if not sample_path.is_file():
                raise FileNotFoundError(f"Missing VoxCPM2 Mandarin example: {sample_path}")
            sample_audio, sample_rate = sf.read(sample_path, dtype="float32")
            if sample_audio.ndim > 1:
                sample_audio = sample_audio.mean(axis=1)
            if sample_rate != SAMPLE_RATE:
                sample_audio = resample_voice(sample_audio, sample_rate)
            parts.extend([
                np.zeros(int(SAMPLE_RATE * 0.4), dtype=np.float32),
                sample_audio,
            ])
        parts.append(np.zeros(int(SAMPLE_RATE * 0.6), dtype=np.float32))
        combined = np.concatenate(parts)
        scene_wav = output_dir / f"{scene_id}.wav"
        sf.write(scene_wav, combined, SAMPLE_RATE)
        duration = len(combined) / SAMPLE_RATE
        metadata.append({
            "id": scene_id,
            "title": scene.get("title", scene_id),
            "duration": duration,
            "narrationDuration": narration_duration,
            "wav_path": str(scene_wav),
            "slide_path": scene["slide_path"],
        })
        caption_cues.append(
            f"{to_vtt_timestamp(timeline_offset)} --> "
            f"{to_vtt_timestamp(timeline_offset + narration_duration)}\n{narration}"
        )
        timeline_offset += duration
        all_audio_parts.append(combined)
        print(f"VoxCPM Filipino narration ready: unit {position}, {scene_id}")

    master_wav = output_dir / f"mandarin-a1-unit-{position}-fil-master.wav"
    sf.write(master_wav, np.concatenate(all_audio_parts), SAMPLE_RATE)
    (output_dir / "scenes.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (output_dir / f"mandarin-a1-unit-{position}-fil.vtt").write_text(
        "WEBVTT\n\n" + "\n\n".join(caption_cues) + "\n",
        encoding="utf-8",
    )
    build_video(position, metadata, output_dir)


def main():
    parser = argparse.ArgumentParser(description="Generate Filipino teacher videos for Mandarin A1.")
    parser.add_argument(
        "--units",
        type=int,
        nargs="+",
        default=list(range(2, 21)),
        help="Units to generate (2-20; Unit 1 already has a verified Filipino version).",
    )
    args = parser.parse_args()
    positions = sorted(set(args.units))
    if not positions or any(position < 2 or position > 20 for position in positions):
        parser.error("Choose one or more units from 2 through 20.")

    units = load_units()
    print(f"Generating Filipino media for units: {', '.join(map(str, positions))}")
    model = VoxCPM.from_pretrained(
        "openbmb/VoxCPM2",
        load_denoiser=False,
        local_files_only=True,
        optimize=False,
        device="cpu",
    )
    for position in positions:
        write_mandarin_samples(units, position, model)
        generate_unit(position, units[position], model)
    print(f"Finished {len(positions)} Filipino unit videos.")


if __name__ == "__main__":
    main()
