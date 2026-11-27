import os
import numpy as np
import soundfile as sf
from voxcpm import VoxCPM


MODEL_ID = "openbmb/VoxCPM2"
OUTPUT_DIR = os.path.abspath("tmp/kokoro_a1_unit1_filipino/filipino_voice")
os.makedirs(OUTPUT_DIR, exist_ok=True)

VOICE_CONTROL = (
    "A clear, warm, natural female voice speaking Tagalog, "
    "like a patient Mandarin language teacher at a moderate pace."
)

NARRATION = {
    "01_cover": (
        "Maligayang pagdating sa kursong Mandarin A1 ng Kolecion Training Center. "
        "Sa Unang Yunit, pag-aaralan natin ang wastong pagbigkas at mga tono."
    ),
    "02_objectives": (
        "Matututuhan natin ang Zhuyin at Pinyin, ang apat na pangunahing tono at neutral tone, "
        "mga pagbabago sa tono, at mahahalagang pananalita sa klase."
    ),
    "03_tones": (
        "Sa Mandarin, mahalagang bigkasin ang tamang tono dahil maaari nitong baguhin ang kahulugan "
        "ng salita. Makinig sa mga halimbawa at ulitin pagkatapos ng guro."
    ),
    "04_tone_sandhi": (
        "Kapag magkasunod ang dalawang salitang may ikatlong tono, nagiging ikalawang tono ang una. "
        "Nagbabago rin ang bigkas ng bu at yi depende sa kasunod na tono. "
        "Pakinggan ang mga halimbawang Mandarin."
    ),
    "05_vocab_basics": (
        "Tingnan ang mga pangunahing salita sa slide. Makinig sa bigkas ng guro at ulitin ang bawat salita."
    ),
    "06_vocab_courtesy": (
        "Pag-aralan ang mga salitang ginagamit sa pagbibigay-galang at sa klase. "
        "Pakinggan ang tamang bigkas at sabayan ang guro."
    ),
    "07_examples": (
        "Narito ang mga karaniwang pangungusap sa klase. Gamitin ang pakiulit kung hindi mo narinig "
        "nang mabuti, at sabihin na hindi mo naiintindihan kung kailangan mo ng tulong."
    ),
    "08_dialogue": (
        "Magsanay tayo sa isang maikling usapan sa klase. Makinig sa guro at kay Wang Ming. "
        "Pansinin kung paano magpakilala at magalang na humiling na ulitin ang sinabi."
    ),
    "09_conclusion": (
        "Binabati kita! Natapos mo ang Unang Yunit tungkol sa pagbigkas at mga tono. "
        "Balikan at sanayin ang mga salita at pangungusap. Magkita tayo sa Ikalawang Yunit tungkol sa pagbati at pagpapakilala."
    ),
}

model = VoxCPM.from_pretrained(
    MODEL_ID,
    load_denoiser=False,
    local_files_only=True,
    optimize=False,
    device="cpu",
)

for scene_id, narration in NARRATION.items():
    audio = model.generate(
        text=f"({VOICE_CONTROL}){narration}",
        cfg_value=2.0,
        inference_timesteps=10,
    )
    if audio.size == 0:
        raise RuntimeError(f"VoxCPM returned empty audio for {scene_id}")
    if not np.isfinite(audio).all():
        raise RuntimeError(f"VoxCPM returned invalid audio values for {scene_id}")
    output_path = os.path.join(OUTPUT_DIR, f"{scene_id}.wav")
    sf.write(output_path, audio, model.tts_model.sample_rate)
    print(f"Generated Filipino narration {scene_id}")
