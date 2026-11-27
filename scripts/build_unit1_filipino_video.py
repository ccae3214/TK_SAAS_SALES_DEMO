import json
import os
import subprocess


BASE_DIR = os.path.abspath("tmp/kokoro_a1_unit1_filipino")
PUBLIC_VIDEOS = os.path.abspath("public/videos")
os.makedirs(PUBLIC_VIDEOS, exist_ok=True)

with open(os.path.join(BASE_DIR, "scenes.json"), "r", encoding="utf-8") as file:
    scenes = json.load(file)

def run_ffmpeg(command, action):
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"{action} failed:\n{result.stderr[-2000:]}")


final_mp4 = os.path.join(PUBLIC_VIDEOS, "mandarin-a1-unit-1-fil.mp4")
final_mp3 = os.path.join(PUBLIC_VIDEOS, "mandarin-a1-unit-1-fil.mp3")
master_wav = os.path.join(BASE_DIR, "mandarin-a1-unit-1-fil-master.wav")
total_duration = sum(scene["duration"] for scene in scenes)

video_command = [
    "ffmpeg",
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
]
for index, scene in enumerate(scenes):
    duration = scene["duration"] + (1 if index == len(scenes) - 1 else 0)
    video_command.extend(
        [
            "-loop",
            "1",
            "-framerate",
            "30",
            "-t",
            f"{duration:.6f}",
            "-i",
            scene["slide_path"],
        ]
    )
video_command.extend(["-i", master_wav])

video_streams = []
filters = []
for index, scene in enumerate(scenes):
    stream = f"slide{index}"
    video_streams.append(f"[{stream}]")
    filters.append(
        f"[{index}:v]setpts=PTS-STARTPTS,setsar=1[{stream}]"
    )
filters.append(
    f"{''.join(video_streams)}concat=n={len(scenes)}:v=1:a=0[outv]"
)
video_command.extend(
    [
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[outv]",
        "-map",
        f"{len(scenes)}:a:0",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-tune",
        "stillimage",
        "-r",
        "30",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-pix_fmt",
        "yuv420p",
        "-t",
        f"{total_duration:.6f}",
        final_mp4,
    ]
)
run_ffmpeg(video_command, "Encoding Filipino lesson video")

run_ffmpeg(
    [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        master_wav,
        "-c:a",
        "libmp3lame",
        "-qscale:a",
        "2",
        final_mp3,
    ],
    "Encoding Filipino lesson audio",
)

captions_source = os.path.join(BASE_DIR, "mandarin-a1-unit-1-fil.vtt")
captions_target = os.path.join(PUBLIC_VIDEOS, "mandarin-a1-unit-1-fil.vtt")
with open(captions_source, "r", encoding="utf-8") as source:
    with open(captions_target, "w", encoding="utf-8") as target:
        target.write(source.read())

print(f"Generated {final_mp4}")
print(f"Generated {final_mp3}")
