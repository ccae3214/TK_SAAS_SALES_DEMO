import os
import inspect
import subprocess
import types
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from huggingface_hub import snapshot_download
from transformers import AutoConfig, AutoModel, AutoTokenizer
from transformers.dynamic_module_utils import get_class_from_dynamic_module


ROOT = Path(__file__).resolve().parents[1]
WORK_DIR = ROOT / "tmp" / "moss_tts_mandarin_audition"
OUTPUT_DIR = ROOT / "deliverables"
MODEL_ID = "OpenMOSS-Team/MOSS-TTS-Local-Transformer"
CODEC_ID = "OpenMOSS-Team/MOSS-Audio-Tokenizer"
VOICE_REFERENCE = (
    ROOT
    / "tmp"
    / "mandarin_a1_unit1_voxcpm2_audition"
    / "mandarin_demo_voice_reference.wav"
)
TARGETS = [
    (
        "ma2",
        "麻",
        "第二聲",
        "Speak standard Mandarin. Pronounce ma in the second tone with a clear rising pitch, starting low and rising to high.",
    ),
    (
        "ma3",
        "馬",
        "第三聲",
        "Speak standard Mandarin. Pronounce ma in the third tone with a clear low falling-rising pitch: start high, fall low, then rise high.",
    ),
]
GAP_SECONDS = 1.5


def main() -> None:
    os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if not VOICE_REFERENCE.is_file():
        raise FileNotFoundError(f"Missing consistent Mandarin voice reference: {VOICE_REFERENCE}")

    cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
    model_dir = Path(
        snapshot_download(
            repo_id=MODEL_ID,
            cache_dir=str(cache_dir),
            allow_patterns=[
                "*.json", "*.py", "*.jinja", "*.txt", "*.safetensors", "README.md"
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
    device = torch.device("cpu")
    dtype = torch.bfloat16
    print(f"Loading MOSS-TTS Local 1.7B in {dtype} on CPU...", flush=True)
    model_config = AutoConfig.from_pretrained(str(model_dir), trust_remote_code=True)
    # Transformers 5 expects the nested Qwen3 text config for its KV-cache setup.
    # This checkpoint's remote config predates that API and otherwise returns itself.
    if not hasattr(model_config, "num_hidden_layers") and hasattr(model_config, "language_config"):
        model_config.get_text_config = lambda *args, **kwargs: model_config.language_config
    tokenizer = AutoTokenizer.from_pretrained(str(model_dir), trust_remote_code=True)
    audio_tokenizer = AutoModel.from_pretrained(
        str(codec_dir),
        trust_remote_code=True,
    ).to(device=device)
    processor_class = get_class_from_dynamic_module(
        "processing_moss_tts.MossTTSDelayProcessor",
        str(model_dir),
    )
    processor = processor_class(
        tokenizer=tokenizer,
        audio_tokenizer=audio_tokenizer,
        model_config=model_config,
    )

    reference_waveform, reference_rate = sf.read(VOICE_REFERENCE, dtype="float32")
    reference_waveform = np.asarray(reference_waveform, dtype=np.float32)
    if reference_waveform.ndim == 1:
        reference_waveform = reference_waveform[None, :]
    elif reference_waveform.ndim == 2:
        reference_waveform = reference_waveform.T
    else:
        raise RuntimeError("Expected a mono or stereo Mandarin reference WAV")
    reference_tensor = torch.from_numpy(reference_waveform.copy())
    reference_codes = processor.encode_audios_from_wav(
        [reference_tensor], sampling_rate=int(reference_rate)
    )[0]

    model = AutoModel.from_pretrained(
        str(model_dir),
        trust_remote_code=True,
        config=model_config,
        attn_implementation="eager",
        dtype=dtype,
    ).to(device)
    model.eval()
    mask_builder_globals = model.local_transformer.forward.__globals__
    original_mask_builder = mask_builder_globals.get("create_causal_mask")
    if original_mask_builder is not None:
        accepted_mask_kwargs = set(inspect.signature(original_mask_builder).parameters)
        def _create_causal_mask_compat(*args, **kwargs):
            if "input_embeds" in kwargs and "inputs_embeds" not in kwargs:
                kwargs["inputs_embeds"] = kwargs.pop("input_embeds")
            kwargs = {key: value for key, value in kwargs.items() if key in accepted_mask_kwargs}
            return original_mask_builder(*args, **kwargs)

        mask_builder_globals["create_causal_mask"] = _create_causal_mask_compat
    if not hasattr(model, "_get_initial_cache_position"):
        def _get_initial_cache_position(self, cur_len, cache_device, model_kwargs):
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

        model._get_initial_cache_position = types.MethodType(
            _get_initial_cache_position, model
        )
    sample_rate = int(processor.model_config.sampling_rate)
    silence = np.zeros(round(sample_rate * GAP_SECONDS), dtype=np.float32)
    audition_parts = []
    notes = [
        "MOSS-TTS 普通話單音節聲調試聽",
        "同一段普通話男聲參考音色。兩個目標都以聲調數字拼音輸入 MOSS-TTS。",
        "順序：麻 ma2（第二聲），馬 ma3（第三聲）。",
        "兩段之間停 1.5 秒。",
        "",
    ]

    torch.manual_seed(20261127)
    for index, (pinyin, character, tone_name, instruction) in enumerate(TARGETS):
        message = processor.build_user_message(
            text=pinyin,
            language="Chinese",
            reference=[reference_codes],
            instruction=instruction,
        )
        batch = processor([[message]], mode="generation")
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        print(f"Generating {character} ({pinyin}, {tone_name})...", flush=True)
        with torch.inference_mode():
            generated = model.generate(
                input_ids=input_ids,
                attention_mask=attention_mask,
                max_new_tokens=96,
                text_temperature=0.0,
                audio_temperature=1.0,
                audio_top_p=0.95,
                audio_top_k=50,
                audio_repetition_penalty=1.1,
            )
        decoded = processor.decode(generated)
        if not decoded or not decoded[0].audio_codes_list:
            raise RuntimeError(f"MOSS-TTS returned no audio for {pinyin}")
        waveform = decoded[0].audio_codes_list[0].detach().float().cpu().numpy()
        waveform = np.asarray(waveform, dtype=np.float32).reshape(-1)
        if waveform.size == 0 or not np.isfinite(waveform).all():
            raise RuntimeError(f"MOSS-TTS returned invalid audio for {pinyin}")

        sample_path = WORK_DIR / f"{pinyin}.wav"
        sf.write(sample_path, waveform, sample_rate)
        audition_parts.append(waveform)
        if index < len(TARGETS) - 1:
            audition_parts.append(silence)
        print(f"Created {character} sample, {len(waveform) / sample_rate:.2f}s.", flush=True)

    combined = np.concatenate(audition_parts)
    wav_path = OUTPUT_DIR / "mandarin-a1-unit1-moss-tts-tone-audition.wav"
    mp3_path = OUTPUT_DIR / "mandarin-a1-unit1-moss-tts-tone-audition.mp3"
    notes_path = OUTPUT_DIR / "mandarin-a1-unit1-moss-tts-tone-audition.txt"
    sf.write(wav_path, combined, sample_rate)
    notes_path.write_text("\n".join(notes), encoding="utf-8")
    result = subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(wav_path), "-c:a", "libmp3lame", "-qscale:a", "2",
            "-ar", "48000", str(mp3_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode:
        raise RuntimeError(f"MP3 encoding failed:\n{result.stderr[-2000:]}")
    print(f"Created {mp3_path}", flush=True)
    print(f"Created {wav_path}", flush=True)
    print(f"Created {notes_path}", flush=True)


if __name__ == "__main__":
    main()
