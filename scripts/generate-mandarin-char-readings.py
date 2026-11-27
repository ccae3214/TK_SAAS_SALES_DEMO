"""產生拼音檢查用的「字音表」：src/data/mandarin-char-readings.json。

只收中文 A1 課程（scripts/seed-mandarin-a1-course.sql）的「中文 | 拼音」欄位用到的字，
每個字列出 pypinyin 字典裡的所有讀音（含聲調），另附普通話合法音節表（不含聲調）。
台灣讀音（例如 垃圾 lèsè、星期 xīngqí）不在這裡加，寫在 src/lib/mandarin-pinyin-check.js 的 TAIWAN_READINGS。

課程加了新字、檢查出現「字音表沒有這個字」時再執行一次（需要 pip install pypinyin）：
    python scripts/generate-mandarin-char-readings.py
平常跑檢查（npm run test:hr、node scripts/check-mandarin-pinyin.mjs）不需要 Python。
"""
import json
import re
import unicodedata
from pathlib import Path

import pypinyin
from pypinyin import pinyin_dict

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "scripts" / "seed-mandarin-a1-course.sql"
OUTPUT = ROOT / "src" / "data" / "mandarin-char-readings.json"
TONE_MARKS = {"̄", "́", "̌", "̀"}
HANZI = re.compile(r"[㐀-䶿一-鿿]")


def toneless(reading):
    base = "".join(ch for ch in unicodedata.normalize("NFD", reading) if ch not in TONE_MARKS)
    return unicodedata.normalize("NFC", base)


def course_chars():
    chars = set()
    for line in SEED.read_text(encoding="utf-8").splitlines():
        if not re.match(r"^\s+\(\d+, E'", line):
            continue
        for text in re.findall(r"E'((?:[^']|'')*)'", line):
            for row in text.split("\\n"):
                parts = row.split(" | ")
                if len(parts) >= 2:
                    chars.update(HANZI.findall(parts[0]))
    return chars


def main():
    syllables = set()
    for value in pinyin_dict.pinyin_dict.values():
        syllables.update(toneless(reading) for reading in value.split(","))
    readings = {}
    for ch in sorted(course_chars()):
        value = pinyin_dict.pinyin_dict.get(ord(ch))
        if value:
            readings[ch] = value
    data = {
        "source": f"pypinyin {pypinyin.__version__}; regenerate with scripts/generate-mandarin-char-readings.py",
        "syllables": sorted(syllables),
        "chars": readings,
    }
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"{OUTPUT.relative_to(ROOT)}: {len(readings)} chars, {len(syllables)} syllables")


if __name__ == "__main__":
    main()
