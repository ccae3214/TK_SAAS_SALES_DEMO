import os
import json
import subprocess

BASE_DIR = os.path.abspath("tmp/kokoro_a1_unit1")
PUBLIC_VIDEOS = os.path.abspath("public/videos")
os.makedirs(PUBLIC_VIDEOS, exist_ok=True)

with open(os.path.join(BASE_DIR, "scenes.json"), "r", encoding="utf-8") as f:
    scenes = json.load(f)

print(f"Loaded {len(scenes)} scenes.")

concat_list_path = os.path.join(BASE_DIR, "concat_list.txt")
concat_entries = []

for sc in scenes:
    sid = sc["id"]
    png_path = os.path.join(BASE_DIR, f"{sid}.png")
    wav_path = os.path.join(BASE_DIR, f"{sid}.wav")
    mp4_path = os.path.join(BASE_DIR, f"{sid}.mp4")
    
    print(f"Encoding scene {sid} (duration: {sc['duration']:.2f}s)...")
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1",
        "-i", png_path,
        "-i", wav_path,
        "-c:v", "libx264",
        "-preset", "fast",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        mp4_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error encoding scene {sid}:")
        print(res.stderr[-500:])
        exit(1)
    
    concat_entries.append(f"file '{mp4_path.replace(chr(92), '/')}'\n")
    print(f"  [OK] {sid}.mp4 ({os.path.getsize(mp4_path)} bytes)")

with open(concat_list_path, "w", encoding="utf-8") as f:
    f.writelines(concat_entries)

# Concatenate scenes into final video
final_mp4 = os.path.join(PUBLIC_VIDEOS, "mandarin-a1-unit-1.mp4")
print(f"\nConcatenating all scenes into {final_mp4}...")
concat_cmd = [
    "ffmpeg", "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concat_list_path,
    "-c", "copy",
    final_mp4
]
res = subprocess.run(concat_cmd, capture_output=True, text=True)
if res.returncode != 0:
    print("Error during concat:")
    print(res.stderr[-500:])
    exit(1)
print(f"  [OK] Final MP4 generated: {final_mp4} ({os.path.getsize(final_mp4)} bytes)")

# Convert master WAV to MP3
final_mp3 = os.path.join(PUBLIC_VIDEOS, "mandarin-a1-unit-1.mp3")
master_wav = os.path.join(BASE_DIR, "mandarin-a1-unit-1-master.wav")
print(f"\nConverting master audio to MP3: {final_mp3}...")
mp3_cmd = [
    "ffmpeg", "-y",
    "-i", master_wav,
    "-c:a", "libmp3lame",
    "-qscale:a", "2",
    final_mp3
]
res = subprocess.run(mp3_cmd, capture_output=True, text=True)
if res.returncode != 0:
    print("Error during MP3 conversion:")
    print(res.stderr[-500:])
    exit(1)
print(f"  [OK] Final MP3 generated: {final_mp3} ({os.path.getsize(final_mp3)} bytes)")

print("\nAll media exports completed successfully!")
