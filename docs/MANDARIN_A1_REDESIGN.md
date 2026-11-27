# 中文 A1 課程重新設計（菲律賓移工版）

對象：要到台灣（或已在台灣）工作的菲律賓移工，零基礎（CEFR A1／TOCFL 入門～Level 1）。
職別：看護、家庭幫傭、工廠、農工。用語：台灣繁體中文、台灣用語（便當、悠遊卡、阿公阿嬤、老闆、垃圾車）。
說明語言：中文＋英文（現有欄位），Filipino 經由 `tl` 字典顯示（見「五、Filipino 說明怎麼顯示」）。

## 一、現況（查過的程式與資料）

| 項目 | 位置 | 說明 |
|---|---|---|
| 課程資料 | `scripts/seed-mandarin-a1-course.sql` | 20 個單元、240 小時，每單元欄位：topics／topics_en、examples、vocabulary、dialogue（每行「中文 \| 拼音 \| 英文」）、category。只新增、不覆蓋（`ON CONFLICT DO NOTHING`）。 |
| 顯示 | `src/components/HrWorkerLearning.jsx`、`HrLessonVocabulary.jsx`、`HrUnitQuiz.jsx` | 學習重點、例句、詞彙表（多義字、造句）、對話、朗讀、自動小測驗（看中文選英文）。 |
| Unit 1 影片 | `public/videos/mandarin-a1-unit-1.mp4/.mp3`；Filipino 版 `-fil.mp4/.mp3/.vtt` | 「中文旁白／Filipino na paliwanag」切換鈕；Filipino 旁白由 `scripts/generate_mandarin_a1_filipino_media.py` 依單元位置（1–20）產生，裡面有每單元的 Filipino 標題與主題。 |
| 測試 | `tests/hr-mandarin-a1-course-seed.test.mjs` 等 | 20 單元、240 小時、不重複詞彙 ≥ 800、每行 3 欄、拼音音節數＝漢字數。 |

用 pypinyin 字典初步比對現有 1,013 行：音節／字的對應幾乎都正確，但讀音是**大陸標準**，不是台灣讀音，例如 星期 xīngqī（台灣 xīngqí）、客氣 kèqi（台灣 kèqì）、喜歡 xǐhuan（台灣 xǐhuān）、血壓 xuèyā（台灣 xiěyā）、垃圾 lājī（台灣標準 lèsè）、一一九 yāo yāo jiǔ（台灣多唸 yī yī jiǔ）。單元順序也先排 12 個一般主題，移工最急用的安全、求助、看護排在後面。

## 二、拼音標注規則（要寫進 Unit 1 和教師說明）

1. **以台灣教育部《國語辭典》讀音為主**，大陸讀音不同時在英文欄加註，例如：
   - 垃圾 lèsè（台灣標準）；口語常聽到 lājī → `trash (Taiwan standard lèsè; often said lājī)`
   - 和 hàn（台灣口語）／hé → 課文用 hàn，詞彙註明 hé
   - 星期 xīngqí、認識 rènshì、休息 xiūxí、時候 shíhòu、東西 dōngxi、血 xiě、垃圾 lèsè、誰 shéi
2. 依《漢語拼音正詞法基本規則》：以詞為單位連寫（qǐngwèn、xièxie）、句首與專有名詞大寫（Táiwān、Fēilǜbīn）、聲調符號標在主要母音上、輕聲不標。
3. **輕聲**只用在：的、了、嗎、呢、吧、著、過、們、子（詞尾）、重疊字第二字（媽媽 māma、謝謝 xièxie）和台灣也唸輕聲的固定詞（東西 dōngxi、什麼 shénme、我們 wǒmen）。其他字一律標聲調。
4. **變調**：
   - 三聲＋三聲：前字實際唸二聲，但**拼音照標原調**（你好 nǐ hǎo），Unit 1 用說明教。
   - 「不」：四聲前唸並標 bú（不是 bú shì），其他標 bù。
   - 「一」：四聲（及輕聲由四聲變來）前標 yí（一個 yí ge），一、二、三聲前標 yì（一天 yìtiān），單唸、數數、序數、號碼標 yī（第一 dì-yī、一一九 yī yī jiǔ）。
   - 「一」「不」標實際讀音，這是正詞法允許的「語音教學依需要標變調」做法，也是台灣華語教材通用的方式；檢查腳本會依下一個字的聲調驗證。
5. **ü**：n、l 後面寫 ü（女 nǚ、綠 lǜ）；j、q、x、y 後面寫 u（去 qù、魚 yú）。
6. **隔音符號 '**：a、o、e 開頭的音節接在別的音節後面要加 '（西安 Xī'ān、平安 píng'ān、晚安 wǎn'ān）。

## 三、單元架構（20 單元、240 小時，維持現有數量讓 Unit 1 影片、Filipino 旁白腳本、測試都能沿用）

| # | 分類 | 單元 | 時數 | 重點（A1，句子 5–8 字） |
|---|---|---|---|---|
| 1 | 基礎 | 發音與聲調 | 10 | 四聲、輕聲、三聲變調、一／不變調、ü、zh ch sh／j q x、課堂用語（請再說一次、我聽不懂）— **保留現有主題，影片與 Filipino 旁白不受影響** |
| 2 | 基礎 | 問候、禮貌與自我介紹 | 10 | 你好、不好意思、謝謝、對不起、我是菲律賓人、我叫…、稱呼（先生、小姐、阿公、阿嬤、老闆） |
| 3 | 基礎 | 數字、時間與日期 | 12 | 0–100、電話號碼、幾點、星期、今天明天、「兩／二」 |
| 4 | 到台灣 | 機場、仲介與證件 | 10 | 護照、居留證、仲介、雇主、地址、「我的…不見了」 |
| 5 | 到台灣 | 住宿與垃圾分類 | 12 | 宿舍、房間、洗衣機、垃圾車、資源回收、廚餘、宿舍規定 |
| 6 | 到台灣 | 吃飯與便利商店 | 12 | 便當、7-11、內用外帶、微波、不辣、我不吃豬肉 |
| 7 | 到台灣 | 交通與問路 | 12 | 公車、捷運、火車、悠遊卡、在哪裡、左右前後 |
| 8 | 到台灣 | 購物、錢與匯款 | 12 | 多少錢、太貴了、市場、ATM、匯款回菲律賓、收據 |
| 9 | 工作基本 | 上班、班別與聽懂指令 | 14 | 上班下班、打卡、早班晚班、請、快一點、等一下、好的、我做完了 |
| 10 | 工作基本 | 工作安全與警告標示 ⚠️ | 14 | 危險、小心、禁止、出口、安全帽、手套、別碰、受傷了 |
| 11 | 工作基本 | 薪水、加班、請假與休假 | 12 | 薪水、加班費、休假、請假、生病、合約 |
| 12 | 看護 | 看護（一）：起床、吃飯、吃藥 | 14 | 阿嬤起床了、慢慢吃、吃藥、喝水、輪椅 |
| 13 | 看護 | 看護（二）：洗澡、如廁、翻身與量血壓 | 14 | 洗澡、尿布、翻身、血壓、體溫、復健、散步、跟家屬回報 |
| 14 | 家庭幫傭 | 家事：打掃、洗衣、煮飯、照顧小孩 | 14 | 掃地、拖地、洗碗、晾衣服、接小孩、買菜 |
| 15 | 工廠 | 工廠：機器、產線與品管 | 14 | 機器、開關、產線、不良品、搬、貼標籤、組長 |
| 16 | 農工 | 農業：農場、溫室與採收 | 12 | 種菜、澆水、施肥、採收、雞舍、溫室、鋤頭 |
| 17 | 生活服務 | 身體不舒服與看醫生 | 12 | 頭痛、發燒、健保卡、掛號、藥局、一天三次 |
| 18 | 生活服務 | 手機、網路、天氣與聯絡家人 | 10 | 充電、Wi-Fi、視訊、儲值、颱風、下雨、帶傘 |
| 19 | 生活服務 | 緊急求助與勞工權益 | 10 | 119、110、1955 勞工專線、救命、我要回報、我不舒服、這裡是… |
| 20 | 複習 | 總複習與模擬測驗 | 10 | 各單元重點複習、仿 TOCFL 聽讀題、口說任務 |

合計 240 小時。每單元的內容對應教材六段式（菲律賓中文 A1 老師的格式）：

| 教材段落 | 放在哪裡 |
|---|---|
| 🎯 學習目標 | topics／topics_en（2–3 個目標） |
| 💬 實用對話 | dialogue（6–10 行，A／B） |
| 📚 詞彙與 ⚠️ 必記標示 | vocabulary（英文欄加 `⚠️ sign:` 標記看得懂的告示；附造句） |
| 🗣️ 發音提示與句型 | examples（1 個句型公式＋例句）；topics 寫一句發音提示 |
| 🇹🇼 台灣文化與職場提醒 | topics 最後一句（例如「不好意思」開口、垃圾車時間、尊重長輩） |
| ✍️ 小測驗 | 現有自動小測驗（從詞彙出題），不用改 |

詞彙量：維持不重複詞彙 ≥ 800 的要求，實際 **871 個**（第 1–19 單元不重複；第 20 單元總複習重用 50 個重點詞）。

## 四、拼音檢查（可重跑）

- `scripts/check-mandarin-pinyin.mjs`：讀 seed SQL，逐行、逐字比對，印出報告；有錯時 exit code 1。
- `tests/hr-mandarin-a1-pinyin.test.mjs`：`npm run test:hr` 會跑同一套檢查。
- 字音表 `src/data/mandarin-char-readings.json`：用 pypinyin 產生（只收課程用到的字）；台灣讀音補充表 `TAIWAN_READINGS`、必用台灣讀音 `TAIWAN_FORMS`、輕聲白名單 `NEUTRAL_CHARS`／`NEUTRAL_WORDS` 在 `src/lib/mandarin-pinyin-check.js`。產生腳本 `scripts/generate-mandarin-char-readings.py`，平常跑檢查不需要 Python。
- 檢查項目：音節數＝漢字數、每個音節是合法的普通話音節、聲調符號合法且標在正確母音上、非輕聲字一定有聲調、每個字的讀音在字音表內、「一」「不」變調依下一字聲調正確、ü／u 寫法、隔音符號、句首大寫。

## 五、Filipino 說明怎麼顯示

目前詞彙、例句、對話只有英文欄；介面語言選 Filipino 時，單元名稱和學習重點會用 `tlText()` 查 `src/data/tl-dictionary.js` 翻成 Filipino。計畫：

- `src/data/tl-mandarin-a1.js`（English → Filipino，1,193 筆，由產生腳本輸出），由 `src/lib/use-lesson-tl.js` 在 Filipino 介面才動態載入，不增加其他頁面的大小。
- Filipino 介面：單元名稱、分類、學習重點顯示 Filipino；例句、對話、詞彙在英文下面多一行 Filipino。影片播放器與「中文旁白／Filipino na paliwanag」切換不變。
- `generate_mandarin_a1_filipino_media.py` 裡每單元的 Filipino 標題與主題同步更新（Unit 1 不變，現有 Filipino 旁白影片照常使用）。

## 六、既有資料庫怎麼更新

seed 是「只新增、不覆蓋」，已經匯入過舊版的資料庫不會變。建議：

- 改寫 `seed-mandarin-a1-course.sql`（新安裝用）。
- 另寫 `scripts/update-mandarin-a1-course.sql`：依「單元位置」更新同一門課的 20 個單元內容，**單元 ID 不變**，工人的學習進度不會消失；要手動執行才會覆蓋。

## 七、檔案與重新產生

| 檔案 | 用途 |
|---|---|
| `scripts/mandarin-a1/units-*.mjs` | **課程原始資料**（每行「中文 \| 拼音 \| English \| Filipino」），要改內容改這裡 |
| `scripts/build-mandarin-a1-course.mjs` | 產生 seed SQL、更新 SQL、Filipino 對照；會擋詞彙重複、欄位缺漏、同一句英文兩種翻譯 |
| `scripts/seed-mandarin-a1-course.sql` | 新安裝用（只新增、不覆蓋） |
| `scripts/update-mandarin-a1-course.sql` | 既有資料庫換新版（依位置更新，單元 ID 不變） |
| `scripts/check-mandarin-pinyin.mjs` | 拼音檢查報告（有錯 exit code 1） |
| `tests/hr-mandarin-a1-pinyin.test.mjs` | `npm run test:hr` 的拼音、Filipino 覆蓋率、更新腳本測試 |

改完內容的流程：

```
node scripts/build-mandarin-a1-course.mjs
python scripts/generate-mandarin-char-readings.py   # 有新字時才需要
node scripts/check-mandarin-pinyin.mjs
```

另外 `scripts/generate_mandarin_a1_filipino_media.py` 的 Filipino 單元標題與主題已同步成新單元；Unit 1 影片內容（發音與聲調）沒有改變，現有影片照常使用，其他單元影片要重新產生時才會用到新文字。
