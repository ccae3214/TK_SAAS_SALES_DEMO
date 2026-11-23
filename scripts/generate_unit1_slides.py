import os
import sys
import subprocess

OUT_DIR = os.path.abspath("tmp/kokoro_a1_unit1")
os.makedirs(OUT_DIR, exist_ok=True)

FONT_REG = "C\\:/Windows/Fonts/msyh.ttc"
FONT_BOLD = "C\\:/Windows/Fonts/msyhbd.ttc"

def make_header(title_right):
    return (
        f"drawbox=x=0:y=0:w=14:h=720:color=#f59e0b@1:t=fill,"
        f"drawbox=x=50:y=30:w=1180:h=85:color=#17386d@1:t=fill,"
        f"drawtext=fontfile='{FONT_BOLD}':text='KOLECION 訓練中心 ｜ 華語 A1 課程':fontcolor=#f59e0b:fontsize=20:x=80:y=42,"
        f"drawtext=fontfile='{FONT_BOLD}':text='第 1 單元：發音與聲調 ｜ {title_right}':fontcolor=white:fontsize=30:x=80:y=70,"
        f"drawtext=fontfile='{FONT_REG}':text='KOLECION Training Center · Mandarin A1 Course (TOCFL Level 1) · 單元 01 發音與聲調':fontcolor=#94a3b8:fontsize=16:x=340:y=685"
    )

SLIDES = {}

# Slide 1: Cover
SLIDES["01_cover"] = (
    make_header("單元導覽 (Unit Overview)") + ","
    # Main central card
    "drawbox=x=120:y=150:w=1040:h=500:color=#153464@1:t=fill,"
    f"drawbox=x=440:y=180:w=400:h=45:color=#f59e0b@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='TOCFL A1 / CEFR A1':fontcolor=#0f172a:fontsize=22:x=525:y=190,"
    f"drawtext=fontfile='{FONT_BOLD}':text='為菲律賓移工打造的華語課程':fontcolor=white:fontsize=46:x=230:y=265,"
    f"drawtext=fontfile='{FONT_REG}':text='Mandarin Courses for Filipino Migrant Workers':fontcolor=#93c5fd:fontsize=24:x=360:y=340,"
    f"drawbox=x=200:y=400:w=880:h=90:color=#1f4682@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='學好華語，工作與生活更安心':fontcolor=#facc15:fontsize=32:x=400:y=415,"
    f"drawtext=fontfile='{FONT_REG}':text='Learn Mandarin for work and daily life in Taiwan':fontcolor=#e2e8f0:fontsize=20:x=385:y=455,"
    f"drawtext=fontfile='{FONT_BOLD}':text='共 20 個單元 ｜ 240 小時 ｜ 800 個實用詞彙':fontcolor=#38bdf8:fontsize=22:x=390:y=540,"
    f"drawtext=fontfile='{FONT_REG}':text='第一單元時數：8 小時 ｜ 包含詞彙、例句、情境對話':fontcolor=#cbd5e1:fontsize=18:x=410:y=590"
)

# Slide 2: Objectives
SLIDES["02_objectives"] = (
    make_header("學習重點 (Learning Objectives)") + ","
    # 4 Cards
    f"drawbox=x=80:y=150:w=530:h=235:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='[01] 注音符號與漢語拼音':fontcolor=#38bdf8:fontsize=26:x=110:y=175,"
    f"drawtext=fontfile='{FONT_REG}':text='Zhuyin & Pinyin Pronunciation':fontcolor=#93c5fd:fontsize=18:x=110:y=215,"
    f"drawtext=fontfile='{FONT_REG}':text='• 掌握基礎拼音音節結構與字母讀音':fontcolor=white:fontsize=20:x=110:y=260,"
    f"drawtext=fontfile='{FONT_REG}':text='• 聲母、韻母與台灣注音對照認識':fontcolor=#cbd5e1:fontsize=18:x=110:y=305,"
    
    f"drawbox=x=670:y=150:w=530:h=235:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='[02] 四個基本聲調與輕聲':fontcolor=#38bdf8:fontsize=26:x=700:y=175,"
    f"drawtext=fontfile='{FONT_REG}':text='The Four Tones & Neutral Tone':fontcolor=#93c5fd:fontsize=18:x=700:y=215,"
    f"drawtext=fontfile='{FONT_REG}':text='• 陰平 55、陽平 35、上聲 214、去聲 51':fontcolor=white:fontsize=20:x=700:y=260,"
    f"drawtext=fontfile='{FONT_REG}':text='• 體會調值起伏，避免音調混淆':fontcolor=#cbd5e1:fontsize=18:x=700:y=305,"
    
    f"drawbox=x=80:y=415:w=530:h=235:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='[03] 三聲連讀與變調規則':fontcolor=#38bdf8:fontsize=26:x=110:y=440,"
    f"drawtext=fontfile='{FONT_REG}':text='Tone Sandhi & Sound Changes':fontcolor=#93c5fd:fontsize=18:x=110:y=480,"
    f"drawtext=fontfile='{FONT_REG}':text='• 兩個三聲連讀變為二聲加三聲':fontcolor=white:fontsize=20:x=110:y=525,"
    f"drawtext=fontfile='{FONT_REG}':text='• 『不』與『一』遇到四聲變二聲規則':fontcolor=#cbd5e1:fontsize=18:x=110:y=570,"
    
    f"drawbox=x=670:y=415:w=530:h=235:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='[04] 課堂必備基礎用語':fontcolor=#38bdf8:fontsize=26:x=700:y=440,"
    f"drawtext=fontfile='{FONT_REG}':text='Essential Classroom Phrases':fontcolor=#93c5fd:fontsize=18:x=700:y=480,"
    f"drawtext=fontfile='{FONT_REG}':text='• 你好、謝謝、再見、對不起、不客氣':fontcolor=white:fontsize=20:x=700:y=525,"
    f"drawtext=fontfile='{FONT_REG}':text='• 聽不懂時說：『請再說一次』、『我不懂』':fontcolor=#cbd5e1:fontsize=18:x=700:y=570"
)

# Slide 3: Tones
SLIDES["03_tones"] = (
    make_header("四個基本聲調對比 (The Four Tones)") + ","
    # 4 Columns
    f"drawbox=x=50:y=140:w=275:h=470:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='第一聲 (陰平)':fontcolor=#38bdf8:fontsize=24:x=90:y=170,"
    f"drawtext=fontfile='{FONT_BOLD}':text='媽':fontcolor=white:fontsize=84:x=140:y=230,"
    f"drawtext=fontfile='{FONT_BOLD}':text='mā':fontcolor=#fde047:fontsize=36:x=155:y=350,"
    f"drawtext=fontfile='{FONT_BOLD}':text='mother':fontcolor=#ffffff:fontsize=22:x=145:y=420,"
    f"drawbox=x=80:y=470:w=215:h=40:color=#2563eb@1:t=fill,"
    f"drawtext=fontfile='{FONT_REG}':text='高平調 55 — 高而平':fontcolor=white:fontsize=17:x=95:y=480,"
    f"drawtext=fontfile='{FONT_REG}':text='音調維持在高位不降':fontcolor=#cbd5e1:fontsize=16:x=100:y=540,"
    
    f"drawbox=x=350:y=140:w=275:h=470:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='第二聲 (陽平)':fontcolor=#38bdf8:fontsize=24:x=390:y=170,"
    f"drawtext=fontfile='{FONT_BOLD}':text='麻':fontcolor=white:fontsize=84:x=440:y=230,"
    f"drawtext=fontfile='{FONT_BOLD}':text='má':fontcolor=#fde047:fontsize=36:x=455:y=350,"
    f"drawtext=fontfile='{FONT_BOLD}':text='hemp':fontcolor=#ffffff:fontsize=22:x=455:y=420,"
    f"drawbox=x=380:y=470:w=215:h=40:color=#2563eb@1:t=fill,"
    f"drawtext=fontfile='{FONT_REG}':text='上升調 35 — 往上揚':fontcolor=white:fontsize=17:x=395:y=480,"
    f"drawtext=fontfile='{FONT_REG}':text='如英文疑問句結尾上揚':fontcolor=#cbd5e1:fontsize=16:x=385:y=540,"
    
    f"drawbox=x=650:y=140:w=275:h=470:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='第三聲 (上聲)':fontcolor=#38bdf8:fontsize=24:x=690:y=170,"
    f"drawtext=fontfile='{FONT_BOLD}':text='馬':fontcolor=white:fontsize=84:x=740:y=230,"
    f"drawtext=fontfile='{FONT_BOLD}':text='mǎ':fontcolor=#fde047:fontsize=36:x=755:y=350,"
    f"drawtext=fontfile='{FONT_BOLD}':text='horse':fontcolor=#ffffff:fontsize=22:x=755:y=420,"
    f"drawbox=x=680:y=470:w=215:h=40:color=#2563eb@1:t=fill,"
    f"drawtext=fontfile='{FONT_REG}':text='降升調 214 — 先降後升':fontcolor=white:fontsize=17:x=685:y=480,"
    f"drawtext=fontfile='{FONT_REG}':text='先落到低谷再揚起':fontcolor=#cbd5e1:fontsize=16:x=705:y=540,"
    
    f"drawbox=x=950:y=140:w=275:h=470:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='第四聲 (去聲)':fontcolor=#38bdf8:fontsize=24:x=990:y=170,"
    f"drawtext=fontfile='{FONT_BOLD}':text='罵':fontcolor=white:fontsize=84:x=1040:y=230,"
    f"drawtext=fontfile='{FONT_BOLD}':text='mà':fontcolor=#fde047:fontsize=36:x=1055:y=350,"
    f"drawtext=fontfile='{FONT_BOLD}':text='scold':fontcolor=#ffffff:fontsize=22:x=1055:y=420,"
    f"drawbox=x=980:y=470:w=215:h=40:color=#2563eb@1:t=fill,"
    f"drawtext=fontfile='{FONT_REG}':text='全降調 51 — 短促下降':fontcolor=white:fontsize=17:x=985:y=480,"
    f"drawtext=fontfile='{FONT_REG}':text='乾脆俐落迅速降到底':fontcolor=#cbd5e1:fontsize=16:x=1000:y=540"
)

# Slide 4: Tone Sandhi
SLIDES["04_tone_sandhi"] = (
    make_header("實用變調規則 (Tone Sandhi Rules)") + ","
    # Card 1
    f"drawbox=x=70:y=145:w=1140:h=150:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='規則一：三聲連讀變調 (Third-Tone Sandhi)':fontcolor=#38bdf8:fontsize=24:x=100:y=165,"
    f"drawbox=x=100:y=205:w=260:h=45:color=#2563eb@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='3聲 + 3聲 → 2聲 + 3聲':fontcolor=#fde047:fontsize=20:x=115:y=216,"
    f"drawtext=fontfile='{FONT_BOLD}':text='你好 (nǐ hǎo) 實際發音念作 『ní hǎo』':fontcolor=white:fontsize=22:x=390:y=215,"
    f"drawtext=fontfile='{FONT_REG}':text='連續兩個第三聲時，前字變第二聲，發音更流暢輕鬆':fontcolor=#cbd5e1:fontsize=18:x=390:y=250,"

    # Card 2
    f"drawbox=x=70:y=315:w=1140:h=150:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='規則二：「不」的變調 (Tone Change of 不)':fontcolor=#38bdf8:fontsize=24:x=100:y=335,"
    f"drawbox=x=100:y=375:w=260:h=45:color=#2563eb@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='不 + 4聲 → 2聲 (bú)':fontcolor=#fde047:fontsize=20:x=120:y=386,"
    f"drawtext=fontfile='{FONT_BOLD}':text='不是 (bú shì) 、不客氣 (bú kèqi)':fontcolor=white:fontsize=22:x=390:y=385,"
    f"drawtext=fontfile='{FONT_REG}':text='遇一、二、三聲時維持原四聲：不高 (bù gāo)、不行 (bù xíng)、不好 (bù hǎo)':fontcolor=#cbd5e1:fontsize=18:x=390:y=420,"

    # Card 3
    f"drawbox=x=70:y=485:w=1140:h=150:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='規則三：「一」的變調 (Tone Change of 一)':fontcolor=#38bdf8:fontsize=24:x=100:y=505,"
    f"drawbox=x=100:y=545:w=260:h=45:color=#2563eb@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='一 + 4聲 → 2聲 (yí)':fontcolor=#fde047:fontsize=20:x=120:y=556,"
    f"drawtext=fontfile='{FONT_BOLD}':text='一次 (yí cì)、一共 (yígòng) ｜ 一天 (yì tiān)、一起 (yìqǐ)':fontcolor=white:fontsize=22:x=390:y=555,"
    f"drawtext=fontfile='{FONT_REG}':text='在四聲前變二聲；在一二三聲前變四聲；單念或序數讀一聲 (yī)':fontcolor=#cbd5e1:fontsize=18:x=390:y=590"
)

# Slide 5: Vocab 1 (Basics)
SLIDES["05_vocab_basics"] = (
    make_header("核心詞彙 1：人稱與基本字") + ","
    # Top Row 4 cards
    f"drawbox=x=60:y=150:w=265:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='你':fontcolor=white:fontsize=64:x=150:y=180,"
    f"drawtext=fontfile='{FONT_BOLD}':text='nǐ':fontcolor=#fde047:fontsize=32:x=170:y=270,"
    f"drawtext=fontfile='{FONT_REG}':text='you (你 / 3聲)':fontcolor=#cbd5e1:fontsize=20:x=115:y=320,"
    
    f"drawbox=x=355:y=150:w=265:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='好':fontcolor=white:fontsize=64:x=445:y=180,"
    f"drawtext=fontfile='{FONT_BOLD}':text='hǎo':fontcolor=#fde047:fontsize=32:x=455:y=270,"
    f"drawtext=fontfile='{FONT_REG}':text='good / well (好 / 3聲)':fontcolor=#cbd5e1:fontsize=20:x=390:y=320,"
    
    f"drawbox=x=650:y=150:w=265:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='我':fontcolor=white:fontsize=64:x=740:y=180,"
    f"drawtext=fontfile='{FONT_BOLD}':text='wǒ':fontcolor=#fde047:fontsize=32:x=750:y=270,"
    f"drawtext=fontfile='{FONT_REG}':text='I / me (我 / 3聲)':fontcolor=#cbd5e1:fontsize=20:x=710:y=320,"
    
    f"drawbox=x=945:y=150:w=265:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='他':fontcolor=white:fontsize=64:x=1035:y=180,"
    f"drawtext=fontfile='{FONT_BOLD}':text='tā':fontcolor=#fde047:fontsize=32:x=1055:y=270,"
    f"drawtext=fontfile='{FONT_REG}':text='he / him (他 / 1聲)':fontcolor=#cbd5e1:fontsize=20:x=1000:y=320,"

    # Bottom Row 3 cards
    f"drawbox=x=120:y=400:w=320:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='她':fontcolor=white:fontsize=64:x=240:y=430,"
    f"drawtext=fontfile='{FONT_BOLD}':text='tā':fontcolor=#fde047:fontsize=32:x=260:y=520,"
    f"drawtext=fontfile='{FONT_REG}':text='she / her (她 / 1聲)':fontcolor=#cbd5e1:fontsize=20:x=205:y=570,"
    
    f"drawbox=x=480:y=400:w=320:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='是':fontcolor=white:fontsize=64:x=600:y=430,"
    f"drawtext=fontfile='{FONT_BOLD}':text='shì':fontcolor=#fde047:fontsize=32:x=610:y=520,"
    f"drawtext=fontfile='{FONT_REG}':text='to be / am, is, are (是 / 4聲)':fontcolor=#cbd5e1:fontsize=20:x=515:y=570,"
    
    f"drawbox=x=840:y=400:w=320:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='不':fontcolor=white:fontsize=64:x=960:y=430,"
    f"drawtext=fontfile='{FONT_BOLD}':text='bù':fontcolor=#fde047:fontsize=32:x=970:y=520,"
    f"drawtext=fontfile='{FONT_REG}':text='not / no (不 / 4聲)':fontcolor=#cbd5e1:fontsize=20:x=925:y=570"
)

# Slide 6: Vocab 2 (Courtesy & Classroom)
SLIDES["06_vocab_courtesy"] = (
    make_header("核心詞彙 2：禮貌用語與課堂稱呼") + ","
    # Top Row 4 cards
    f"drawbox=x=60:y=150:w=265:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='謝謝':fontcolor=white:fontsize=52:x=120:y=185,"
    f"drawtext=fontfile='{FONT_BOLD}':text='xièxie':fontcolor=#fde047:fontsize=30:x=140:y=270,"
    f"drawtext=fontfile='{FONT_REG}':text='thank you (4聲+輕聲)':fontcolor=#cbd5e1:fontsize=18:x=105:y=320,"
    
    f"drawbox=x=355:y=150:w=265:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='再見':fontcolor=white:fontsize=52:x=415:y=185,"
    f"drawtext=fontfile='{FONT_BOLD}':text='zàijiàn':fontcolor=#fde047:fontsize=30:x=435:y=270,"
    f"drawtext=fontfile='{FONT_REG}':text='goodbye (4聲+4聲)':fontcolor=#cbd5e1:fontsize=18:x=410:y=320,"
    
    f"drawbox=x=650:y=150:w=265:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='對不起':fontcolor=white:fontsize=46:x=705:y=190,"
    f"drawtext=fontfile='{FONT_BOLD}':text='duìbuqǐ':fontcolor=#fde047:fontsize=28:x=725:y=270,"
    f"drawtext=fontfile='{FONT_REG}':text='sorry (4聲+輕聲+3聲)':fontcolor=#cbd5e1:fontsize=18:x=685:y=320,"
    
    f"drawbox=x=945:y=150:w=265:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='不客氣':fontcolor=white:fontsize=46:x=1000:y=190,"
    f"drawtext=fontfile='{FONT_BOLD}':text='bú kèqi':fontcolor=#fde047:fontsize=28:x=1020:y=270,"
    f"drawtext=fontfile='{FONT_REG}':text='you are welcome':fontcolor=#cbd5e1:fontsize=18:x=1000:y=320,"

    # Bottom Row 3 cards
    f"drawbox=x=120:y=400:w=320:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='老師':fontcolor=white:fontsize=56:x=210:y=435,"
    f"drawtext=fontfile='{FONT_BOLD}':text='lǎoshī':fontcolor=#fde047:fontsize=30:x=235:y=520,"
    f"drawtext=fontfile='{FONT_REG}':text='teacher (3聲+1聲)':fontcolor=#cbd5e1:fontsize=20:x=205:y=570,"
    
    f"drawbox=x=480:y=400:w=320:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='同學':fontcolor=white:fontsize=56:x=570:y=435,"
    f"drawtext=fontfile='{FONT_BOLD}':text='tóngxué':fontcolor=#fde047:fontsize=30:x=580:y=520,"
    f"drawtext=fontfile='{FONT_REG}':text='classmate (2聲+2聲)':fontcolor=#cbd5e1:fontsize=20:x=550:y=570,"
    
    f"drawbox=x=840:y=400:w=320:h=225:color=#1b3f7a@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='請問':fontcolor=white:fontsize=56:x=930:y=435,"
    f"drawtext=fontfile='{FONT_BOLD}':text='qǐngwèn':fontcolor=#fde047:fontsize=30:x=940:y=520,"
    f"drawtext=fontfile='{FONT_REG}':text='excuse me (3聲+4聲)':fontcolor=#cbd5e1:fontsize=20:x=900:y=570"
)

# Slide 7: Examples
SLIDES["07_examples"] = (
    make_header("課堂常用例句 (Key Sentences)") + ","
    # 4 Banners
    f"drawbox=x=80:y=140:w=1120:h=110:color=#1b3f7a@1:t=fill,"
    f"drawbox=x=105:y=165:w=45:h=45:color=#f59e0b@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='1':fontcolor=#0f172a:fontsize=28:x=118:y=170,"
    f"drawtext=fontfile='{FONT_BOLD}':text='你好。':fontcolor=white:fontsize=36:x=180:y=160,"
    f"drawtext=fontfile='{FONT_BOLD}':text='Nǐ hǎo.':fontcolor=#fde047:fontsize=28:x=340:y=168,"
    f"drawtext=fontfile='{FONT_REG}':text='Hello. (最常用的見面打招呼用語)':fontcolor=#cbd5e1:fontsize=22:x=550:y=172,"
    
    f"drawbox=x=80:y=265:w=1120:h=110:color=#1b3f7a@1:t=fill,"
    f"drawbox=x=105:y=290:w=45:h=45:color=#f59e0b@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='2':fontcolor=#0f172a:fontsize=28:x=118:y=295,"
    f"drawtext=fontfile='{FONT_BOLD}':text='謝謝。':fontcolor=white:fontsize=36:x=180:y=285,"
    f"drawtext=fontfile='{FONT_BOLD}':text='Xièxie.':fontcolor=#fde047:fontsize=28:x=340:y=293,"
    f"drawtext=fontfile='{FONT_REG}':text='Thank you. (表達感謝，回答說「不客氣」)':fontcolor=#cbd5e1:fontsize=22:x=550:y=297,"
    
    f"drawbox=x=80:y=390:w=1120:h=110:color=#1b3f7a@1:t=fill,"
    f"drawbox=x=105:y=415:w=45:h=45:color=#f59e0b@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='3':fontcolor=#0f172a:fontsize=28:x=118:y=420,"
    f"drawtext=fontfile='{FONT_BOLD}':text='請再說一次。':fontcolor=white:fontsize=36:x=180:y=410,"
    f"drawtext=fontfile='{FONT_BOLD}':text='Qǐng zài shuō yí cì.':fontcolor=#fde047:fontsize=26:x=430:y=418,"
    f"drawtext=fontfile='{FONT_REG}':text='Please say it again. (沒聽清楚時請對方重說)':fontcolor=#cbd5e1:fontsize=22:x=700:y=422,"
    
    f"drawbox=x=80:y=515:w=1120:h=110:color=#1b3f7a@1:t=fill,"
    f"drawbox=x=105:y=540:w=45:h=45:color=#f59e0b@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='4':fontcolor=#0f172a:fontsize=28:x=118:y=545,"
    f"drawtext=fontfile='{FONT_BOLD}':text='我不懂。':fontcolor=white:fontsize=36:x=180:y=535,"
    f"drawtext=fontfile='{FONT_BOLD}':text='Wǒ bù dǒng.':fontcolor=#fde047:fontsize=28:x=360:y=543,"
    f"drawtext=fontfile='{FONT_REG}':text='I do not understand. (不明白時誠實表達)':fontcolor=#cbd5e1:fontsize=22:x=590:y=547"
)

# Slide 8: Dialogue
SLIDES["08_dialogue"] = (
    make_header("實用情境對話演練 (Dialogue Practice)") + ","
    # 8 Dialogue Lines in stylish alternating conversation blocks
    # Line 1 (A)
    f"drawbox=x=80:y=140:w=540:h=110:color=#163768@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='A 老師':fontcolor=#f59e0b:fontsize=20:x=100:y=152,"
    f"drawtext=fontfile='{FONT_BOLD}':text='你好！':fontcolor=white:fontsize=30:x=100:y=180,"
    f"drawtext=fontfile='{FONT_REG}':text='Nǐ hǎo! ｜ Hello!':fontcolor=#cbd5e1:fontsize=18:x=200:y=187,"
    
    # Line 2 (B)
    f"drawbox=x=660:y=140:w=540:h=110:color=#1d437d@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='B 王明':fontcolor=#38bdf8:fontsize=20:x=680:y=152,"
    f"drawtext=fontfile='{FONT_BOLD}':text='你好！':fontcolor=white:fontsize=30:x=680:y=180,"
    f"drawtext=fontfile='{FONT_REG}':text='Nǐ hǎo! ｜ Hello!':fontcolor=#cbd5e1:fontsize=18:x=780:y=187,"
    
    # Line 3 (A)
    f"drawbox=x=80:y=265:w=540:h=110:color=#163768@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='A 老師':fontcolor=#f59e0b:fontsize=20:x=100:y=277,"
    f"drawtext=fontfile='{FONT_BOLD}':text='請問，你叫什麼名字？':fontcolor=white:fontsize=26:x=100:y=305,"
    f"drawtext=fontfile='{FONT_REG}':text='Qǐngwèn, nǐ jiào shénme míngzi? (Excuse me, what is your name?)':fontcolor=#cbd5e1:fontsize=15:x=100:y=345,"
    
    # Line 4 (B)
    f"drawbox=x=660:y=265:w=540:h=110:color=#1d437d@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='B 王明':fontcolor=#38bdf8:fontsize=20:x=680:y=277,"
    f"drawtext=fontfile='{FONT_BOLD}':text='我叫王明。':fontcolor=white:fontsize=28:x=680:y=305,"
    f"drawtext=fontfile='{FONT_REG}':text='Wǒ jiào Wáng Míng. (My name is Wang Ming.)':fontcolor=#cbd5e1:fontsize=16:x=680:y=345,"
    
    # Line 5 (A)
    f"drawbox=x=80:y=390:w=540:h=110:color=#163768@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='A 老師':fontcolor=#f59e0b:fontsize=20:x=100:y=402,"
    f"drawtext=fontfile='{FONT_BOLD}':text='請再說一次。':fontcolor=white:fontsize=28:x=100:y=430,"
    f"drawtext=fontfile='{FONT_REG}':text='Qǐng zài shuō yí cì. (Please say it again.)':fontcolor=#cbd5e1:fontsize=16:x=100:y=470,"
    
    # Line 6 (B)
    f"drawbox=x=660:y=390:w=540:h=110:color=#1d437d@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='B 王明':fontcolor=#38bdf8:fontsize=20:x=680:y=402,"
    f"drawtext=fontfile='{FONT_BOLD}':text='王，明。':fontcolor=white:fontsize=28:x=680:y=430,"
    f"drawtext=fontfile='{FONT_REG}':text='Wáng, Míng. (Wang, Ming.)':fontcolor=#cbd5e1:fontsize=16:x=680:y=470,"
    
    # Line 7 (A)
    f"drawbox=x=80:y=515:w=540:h=110:color=#163768@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='A 老師':fontcolor=#f59e0b:fontsize=20:x=100:y=527,"
    f"drawtext=fontfile='{FONT_BOLD}':text='謝謝。':fontcolor=white:fontsize=28:x=100:y=555,"
    f"drawtext=fontfile='{FONT_REG}':text='Xièxie. (Thank you.)':fontcolor=#cbd5e1:fontsize=16:x=100:y=595,"
    
    # Line 8 (B)
    f"drawbox=x=660:y=515:w=540:h=110:color=#1d437d@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='B 王明':fontcolor=#38bdf8:fontsize=20:x=680:y=527,"
    f"drawtext=fontfile='{FONT_BOLD}':text='不客氣。':fontcolor=white:fontsize=28:x=680:y=555,"
    f"drawtext=fontfile='{FONT_REG}':text='Bú kèqi. (You are welcome.)':fontcolor=#cbd5e1:fontsize=16:x=680:y=595"
)

# Slide 9: Conclusion
SLIDES["09_conclusion"] = (
    make_header("單元結語與複習 (Conclusion & Next Steps)") + ","
    f"drawbox=x=120:y=140:w=1040:h=500:color=#153464@1:t=fill,"
    f"drawbox=x=420:y=175:w=440:h=50:color=#f59e0b@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='單元學習完成 ｜ Completed':fontcolor=#0f172a:fontsize=24:x=485:y=187,"
    f"drawtext=fontfile='{FONT_BOLD}':text='恭喜完成第 1 單元 發音與聲調！':fontcolor=white:fontsize=40:x=290:y=255,"
    f"drawtext=fontfile='{FONT_REG}':text='Congratulations on completing Unit 1 Pronunciation & Tones!':fontcolor=#93c5fd:fontsize=22:x=290:y=310,"
    f"drawbox=x=180:y=360:w=920:h=120:color=#1f4682@1:t=fill,"
    f"drawtext=fontfile='{FONT_BOLD}':text='下一單元預告 - 第 2 單元「問候與自我介紹」':fontcolor=#facc15:fontsize=28:x=280:y=385,"
    f"drawtext=fontfile='{FONT_REG}':text='Next - Unit 2 Greetings & Introductions (打招呼、姓名、國籍、職業與句型)':fontcolor=#e2e8f0:fontsize=18:x=275:y=435,"
    f"drawtext=fontfile='{FONT_BOLD}':text='課後複習 - 請至訓練中心學習專區使用「發音朗讀」與「單元測驗」':fontcolor=#38bdf8:fontsize=20:x=240:y=520,"
    f"drawtext=fontfile='{FONT_REG}':text='KOLECION 訓練中心 祝您學習進步，工作順心！':fontcolor=#cbd5e1:fontsize=20:x=400:y=580"
)

print(f"Generating {len(SLIDES)} slides with ffmpeg...")

for sid, vf_filter in SLIDES.items():
    out_png = os.path.join(OUT_DIR, f"{sid}.png")
    # Clean up single line filter
    filter_arg = vf_filter.replace("\n", "").strip()
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", "color=c=#102a54:s=1280x720:d=1",
        "-vf", filter_arg,
        "-frames:v", "1",
        out_png
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error rendering {sid}:")
        print(res.stderr[-500:])
        sys.exit(1)
    else:
        print(f"  [OK] Rendered {sid}.png ({os.path.getsize(out_png)} bytes)")

print("\nAll slides successfully generated!")
