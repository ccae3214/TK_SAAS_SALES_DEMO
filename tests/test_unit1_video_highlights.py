import unittest

from scripts.generate_unit1_tagalog_video import (
    HIGHLIGHT_BOXES,
    MANDARIN_TTS_SEEDS,
    SCENES,
    highlight_filter,
    mandarin_tts_input,
)


class Unit1VideoHighlightTests(unittest.TestCase):
    def test_all_mandarin_audio_uses_tone_numbered_pinyin(self):
        samples = 0
        for scene in SCENES:
            for index, item in enumerate(scene["mandarin"]):
                text, seed = mandarin_tts_input(scene["id"], index, item)
                self.assertEqual(text, item["pinyin"])
                self.assertIsInstance(text, str)
                self.assertEqual(seed, MANDARIN_TTS_SEEDS.get((scene["id"], index)))
                samples += 1

        self.assertEqual(samples, 37)
        self.assertEqual(SCENES[4]["mandarin"][4]["pinyin"], "ta1")
        self.assertEqual(SCENES[4]["mandarin"][6]["pinyin"], "bu4")
        self.assertEqual(SCENES[5]["mandarin"][3]["pinyin"], "bu4 ke4 qi5")
        self.assertEqual(SCENES[7]["mandarin"][7]["pinyin"], "bu4 ke4 qi5")
        self.assertEqual(MANDARIN_TTS_SEEDS[(3, 1)], 20261128)
        self.assertEqual(MANDARIN_TTS_SEEDS[(6, 1)], 20261128)

    def test_each_mandarin_sample_has_an_in_bounds_highlight(self):
        for scene in SCENES:
            samples = scene["mandarin"]
            if not samples:
                continue

            boxes = HIGHLIGHT_BOXES[scene["id"]]
            self.assertEqual(len(boxes), len(samples), f"slide {scene['id']}")
            for box in boxes:
                x, y, width, height = box
                self.assertGreaterEqual(x, 0)
                self.assertGreaterEqual(y, 0)
                self.assertGreater(width, 0)
                self.assertGreater(height, 0)
                self.assertLessEqual(x + width, 1280)
                self.assertLessEqual(y + height, 720)

    def test_highlight_filter_is_active_only_during_its_cue(self):
        result = highlight_filter(1.25, 2.5, (96, 488, 140, 56))

        self.assertIn("between(t\\,1.250000\\,2.500000)", result)
        self.assertEqual(result.count("drawbox="), 2)

    def test_highlight_filter_rejects_out_of_bounds_boxes(self):
        with self.assertRaises(ValueError):
            highlight_filter(1.0, 2.0, (1200, 680, 100, 60))


if __name__ == "__main__":
    unittest.main()
