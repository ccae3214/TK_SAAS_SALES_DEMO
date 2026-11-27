import unittest
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
import torch

from scripts.moss_tts import MossTTS


class FakeProcessor:
    def __init__(self, waveforms):
        self.messages = []
        self.waveforms = list(waveforms)

    def build_user_message(self, **kwargs):
        self.messages.append(kwargs)
        return kwargs

    def __call__(self, conversations, mode):
        return {
            "input_ids": torch.tensor([[1]]),
            "attention_mask": torch.tensor([[1]]),
        }

    def decode(self, generated):
        waveform = self.waveforms.pop(0)
        return [SimpleNamespace(audio_codes_list=[torch.from_numpy(waveform)])]


class FakeModel:
    def __init__(self):
        self.calls = []

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        return object()


def make_tts(waveforms):
    tts = object.__new__(MossTTS)
    tts.device = torch.device("cpu")
    tts.sample_rate = 10
    tts.reference_codes = "voice-reference"
    tts.processor = FakeProcessor(waveforms)
    tts.model = FakeModel()
    return tts


class MossTTSTests(unittest.TestCase):
    def test_synthesizes_hanzi_without_conflicting_pinyin_instructions(self):
        tts = make_tts([np.zeros(10, dtype=np.float32)])

        result = tts.synthesize("謝謝")

        self.assertEqual(tts.processor.messages, [
            {"text": "謝謝", "reference": ["voice-reference"]}
        ])
        self.assertEqual(tts.model.calls[0]["max_new_tokens"], 96)
        self.assertEqual(result.size, 10)

    def test_synthesizes_tone_numbered_pinyin_with_fixed_seed(self):
        tts = make_tts([np.zeros(10, dtype=np.float32)])

        with patch("scripts.moss_tts.torch.manual_seed") as manual_seed:
            result = tts.synthesize("ma2", seed=20261128)

        self.assertEqual(tts.processor.messages, [
            {"text": "ma2", "reference": ["voice-reference"]}
        ])
        self.assertEqual(tts.model.calls[0]["max_new_tokens"], 64)
        manual_seed.assert_called_once_with(20261128)
        self.assertEqual(result.size, 10)

    def test_retries_implausibly_long_audio(self):
        tts = make_tts([
            np.zeros(60, dtype=np.float32),
            np.zeros(10, dtype=np.float32),
        ])

        result = tts.synthesize("謝謝")

        self.assertEqual(len(tts.model.calls), 2)
        self.assertEqual(result.size, 10)

    def test_raises_if_every_generation_is_implausibly_long(self):
        tts = make_tts([np.zeros(60, dtype=np.float32) for _ in range(3)])

        with self.assertRaisesRegex(RuntimeError, "implausibly long audio"):
            tts.synthesize("謝謝")

    def test_rejects_non_hanzi_input(self):
        tts = make_tts([])

        with self.assertRaisesRegex(ValueError, "Chinese characters"):
            tts.synthesize("xie xie")

        self.assertEqual(tts.model.calls, [])


if __name__ == "__main__":
    unittest.main()
