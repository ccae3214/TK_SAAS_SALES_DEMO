import inspect
import os
import re
import types
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from huggingface_hub import snapshot_download
from transformers import AutoConfig, AutoModel, AutoTokenizer
from transformers.dynamic_module_utils import get_class_from_dynamic_module


MODEL_ID = "OpenMOSS-Team/MOSS-TTS-Local-Transformer"
CODEC_ID = "OpenMOSS-Team/MOSS-Audio-Tokenizer"


class MossTTS:
    def __init__(self, voice_reference: Path):
        os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"
        os.environ["HF_HUB_OFFLINE"] = "1"
        if not voice_reference.is_file():
            raise FileNotFoundError(f"Missing Mandarin voice reference: {voice_reference}")

        cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
        model_dir = Path(
            snapshot_download(
                repo_id=MODEL_ID,
                cache_dir=str(cache_dir),
                allow_patterns=[
                    "*.json",
                    "*.py",
                    "*.jinja",
                    "*.txt",
                    "*.safetensors",
                    "README.md",
                ],
            )
        )
        codec_dir = Path(
            snapshot_download(
                repo_id=CODEC_ID,
                cache_dir=str(cache_dir),
                allow_patterns=["*.json", "*.py", "*.safetensors", "README.md"],
            )
        )

        torch.set_num_threads(min(8, max(2, os.cpu_count() or 4)))
        self.device = torch.device("cpu")
        dtype = torch.bfloat16
        print(f"Loading local MOSS-TTS in {dtype} on CPU...", flush=True)

        model_config = AutoConfig.from_pretrained(str(model_dir), trust_remote_code=True)
        # This checkpoint predates Transformers 5's nested text-config interface.
        if not hasattr(model_config, "num_hidden_layers") and hasattr(
            model_config, "language_config"
        ):
            model_config.get_text_config = lambda *args, **kwargs: model_config.language_config
        tokenizer = AutoTokenizer.from_pretrained(str(model_dir), trust_remote_code=True)
        audio_tokenizer = AutoModel.from_pretrained(
            str(codec_dir),
            trust_remote_code=True,
        ).to(device=self.device)
        processor_class = get_class_from_dynamic_module(
            "processing_moss_tts.MossTTSDelayProcessor",
            str(model_dir),
        )
        self.processor = processor_class(
            tokenizer=tokenizer,
            audio_tokenizer=audio_tokenizer,
            model_config=model_config,
        )

        reference_waveform, reference_rate = sf.read(voice_reference, dtype="float32")
        reference_waveform = np.asarray(reference_waveform, dtype=np.float32)
        if reference_waveform.ndim == 1:
            reference_waveform = reference_waveform[None, :]
        elif reference_waveform.ndim == 2:
            reference_waveform = reference_waveform.T
        else:
            raise RuntimeError("Expected a mono or stereo Mandarin reference WAV")
        reference_tensor = torch.from_numpy(reference_waveform.copy())
        self.reference_codes = self.processor.encode_audios_from_wav(
            [reference_tensor], sampling_rate=int(reference_rate)
        )[0]

        self.model = AutoModel.from_pretrained(
            str(model_dir),
            trust_remote_code=True,
            config=model_config,
            attn_implementation="eager",
            dtype=dtype,
        ).to(self.device)
        self.model.eval()
        mask_builder_globals = self.model.local_transformer.forward.__globals__
        original_mask_builder = mask_builder_globals.get("create_causal_mask")
        if original_mask_builder is not None:
            accepted_mask_kwargs = set(inspect.signature(original_mask_builder).parameters)

            # Adapt this checkpoint's mask arguments to the installed Transformers API.
            def create_causal_mask_compat(*args, **kwargs):
                if "input_embeds" in kwargs and "inputs_embeds" not in kwargs:
                    kwargs["inputs_embeds"] = kwargs.pop("input_embeds")
                kwargs = {
                    key: value
                    for key, value in kwargs.items()
                    if key in accepted_mask_kwargs
                }
                return original_mask_builder(*args, **kwargs)

            mask_builder_globals["create_causal_mask"] = create_causal_mask_compat

        if not hasattr(self.model, "_get_initial_cache_position"):
            def get_initial_cache_position(self, cur_len, cache_device, model_kwargs):
                past = model_kwargs.get("past_key_values")
                if past is None:
                    past_length = 0
                elif hasattr(past, "get_seq_length"):
                    past_length = int(past.get_seq_length())
                else:
                    past_length = int(past[0][0].shape[2]) if len(past) else 0
                if model_kwargs.get("cache_position") is None:
                    model_kwargs["cache_position"] = torch.arange(
                        past_length, cur_len, device=cache_device
                    )
                return model_kwargs

            self.model._get_initial_cache_position = types.MethodType(
                get_initial_cache_position, self.model
            )

        self.sample_rate = int(self.processor.model_config.sampling_rate)
        torch.manual_seed(20261127)

    def synthesize(self, text: str, seed: int | None = None) -> np.ndarray:
        text = text.strip()
        hanzi_count = sum("\u3400" <= character <= "\u9fff" for character in text)
        syllables = text.split()
        is_tone_numbered_pinyin = bool(syllables) and all(
            re.fullmatch(r"[a-z]+[1-5]", syllable) for syllable in syllables
        )
        if not hanzi_count and not is_tone_numbered_pinyin:
            raise ValueError(
                "MOSS-TTS Mandarin input must contain Chinese characters "
                "or tone-numbered Pinyin"
            )
        text_units = hanzi_count or len(syllables)

        message = self.processor.build_user_message(
            text=text,
            reference=[self.reference_codes],
        )
        batch = self.processor([[message]], mode="generation")
        input_ids = batch["input_ids"].to(self.device)
        attention_mask = batch["attention_mask"].to(self.device)
        max_new_tokens = max(64, min(512, 32 * text_units + 32))
        max_duration = max(4.5, 1.5 * text_units + 2.0)
        if seed is not None:
            torch.manual_seed(seed)
        for attempt in range(3):
            with torch.inference_mode():
                generated = self.model.generate(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    max_new_tokens=max_new_tokens,
                    text_temperature=0.0,
                    audio_temperature=1.0,
                    audio_top_p=0.95,
                    audio_top_k=50,
                    audio_repetition_penalty=1.1,
                )
            decoded = self.processor.decode(generated)
            if not decoded or not decoded[0].audio_codes_list:
                raise RuntimeError(f"MOSS-TTS returned no audio for {text!r}")
            waveform = decoded[0].audio_codes_list[0].detach().float().cpu().numpy()
            waveform = np.asarray(waveform, dtype=np.float32).reshape(-1)
            if waveform.size == 0 or not np.isfinite(waveform).all():
                raise RuntimeError(f"MOSS-TTS returned invalid audio for {text!r}")

            duration = waveform.size / self.sample_rate
            if duration <= max_duration:
                return waveform
            if attempt < 2:
                print(
                    f"MOSS-TTS returned {duration:.2f}s for {text!r}; retrying "
                    f"(limit {max_duration:.2f}s).",
                    flush=True,
                )

        raise RuntimeError(
            f"MOSS-TTS repeatedly generated implausibly long audio for {text!r} "
            f"(limit {max_duration:.2f}s)"
        )
