# LINE 記帳機器人（accounting-bot）

在**另一個** LINE 官方帳號上記帳，並每天早上推播「今天該付的帳單」。
以獨立容器跑在既有的 docker compose 堆疊裡，由 nginx 轉送 webhook；資料存在自己的 SQLite volume，
**不碰** HR 系統的 PostgreSQL，也不使用 HR 官方帳號的 `LINE_MESSAGING_*` 憑證。

## 指令

| 指令 | 說明 |
| --- | --- |
| `午餐 120`（或 `記 午餐 120`） | 記一筆支出 |
| `今天` / `本月` | 今日花費 / 本月統計 |
| `刪除記帳 12` | 刪除一筆記帳 |
| `新增帳單 房租 15000 5` | 新增每月 5 號的固定帳單 |
| `帳單` / `今日帳單` | 列出所有帳單 / 今天該付的 |
| `已付 3` | 標記本月已付，並自動記一筆支出 |
| `刪除帳單 3` | 刪除帳單 |
| 傳一張照片 | 辨識發票／轉帳截圖／帳單，見下方「圖片記帳」 |
| `確認` / `取消` | 確認或捨棄剛辨識出的圖片記帳 |
| `改金額 360` / `改名稱 午餐` | 修改剛辨識出、還沒確認的內容 |
| `加入帳單` | 把辨識出的帳單存成每月固定帳單 |

- 每月 31 號的帳單在較短的月份會改在月底提醒。
- 已標記已付的帳單，當月不會再提醒；下個月會重新提醒。
- 每天推播具冪等性：同一天同一人不會收到重複訊息，推播失敗會在下次檢查時重試。
- 1 對 1 聊天、群組與多人聊天室**共用同一本帳**；群組裡看不懂的閒聊不會被回應。

## 圖片記帳（發票、轉帳截圖、帳單）

把照片直接傳給官方帳號：

1. 機器人讀出名稱、金額、日期，附上「✅ 確認記帳／❌ 取消」按鈕。
2. 讀錯了就回 `改金額 360`、`改名稱 午餐`（修改最新一張待確認的）。
3. 按確認才會寫進帳本。**圖片不會直接入帳**，因為 OCR 偶爾會讀錯，多一步確認比帳本裡有錯的數字好。

| 圖片 | 怎麼記 |
| --- | --- |
| 發票／收據 | 金額＝總計，日期＝發票日期（圖上看不到就用今天） |
| 轉帳截圖 | 只記「轉出」；收到的轉帳不記（目前只支援支出） |
| 帳單（電費、電信、信用卡…） | 金額＝應繳總額，記在付款當天；有繳費期限的可存成每月固定帳單 |

- 只支援新台幣；其他幣別會請你自己輸入換算後的金額。
- 同一天已有相同金額的記帳時會提醒「可能重複」。
- 待確認的記錄 24 小時內有效。每個聊天室每天最多辨識 `ACCOUNTING_MAX_IMAGES_PER_DAY`（預設 30）張。
- **群組預設不辨識圖片**：家人群組常有大量不相關的照片，每張都會計費。因為群組和 1 對 1 共用同一本帳，直接私訊機器人傳圖即可；真的要在群組用，設 `ACCOUNTING_IMAGE_IN_GROUPS=1`。
- 拍照小提醒：拍正、光線充足、整張入鏡。LINE 傳照片會壓縮，字很小的明細建議用截圖或拍近一點。

### 啟用

辨識使用 Claude 的視覺能力，需要 Anthropic API 金鑰（到 [console.anthropic.com](https://console.anthropic.com/) 建立，
按用量計費，和 claude.ai 的訂閱是分開的）。在 `.env` 設定：

```
ACCOUNTING_ANTHROPIC_API_KEY=sk-ant-...
# 選填：預設 claude-sonnet-5-5；想省錢可改 claude-haiku-5-5
ACCOUNTING_ANTHROPIC_MODEL=claude-sonnet-5-5
```

然後 `docker compose up -d --force-recreate accounting-bot`。沒設金鑰時，傳圖片會回覆「圖片辨識還沒有啟用」，其他功能不受影響。

### 隱私

- 圖片只在辨識的當下傳給 Anthropic API，**機器人不會存檔**；資料庫只保存辨識出的欄位（名稱、金額、日期）。
- 轉帳截圖和帳單常有帳號、卡號：辨識時會要求模型不要擷取，程式也會把名稱裡 6 位數以上的數字串濾掉。
- 圖片內的文字一律當成資料；辨識結果都會經過驗證（金額範圍、日期範圍、名稱長度），而且要你確認才入帳。

## 部署（接在既有伺服器上）

1. 在 LINE Developers Console 為**新的官方帳號**建立 Messaging API channel，取得 Channel secret 與 Channel access token。
2. 在伺服器的 `.env` 加入：

   ```
   ACCOUNTING_LINE_CHANNEL_SECRET=...
   ACCOUNTING_LINE_CHANNEL_ACCESS_TOKEN=...
   ```

3. `docker compose up -d --build accounting-bot`，並重建 nginx（`nginx.conf` 是單一檔案掛載）：
   `docker compose up -d --force-recreate nginx`。
4. 在 LINE Developers Console 把 Webhook URL 設為 `https://kolecion.cc/line/accounting/callback`，
   開啟 **Use webhook** 並按 **Verify**；到 LINE Official Account Manager 關閉「自動回應訊息」。
5. 用手機加新官方帳號為好友，輸入 `說明`。

每天 08:00（Asia/Taipei）後會自動推播；時間可在 `.env` 用 `ACCOUNTING_REMINDER_TIME=HH:MM` 調整。
只有「有帳單要付」時才推播，節省 LINE 的每月推播額度。

## 本機開發與測試

```bash
cd accounting-bot
pip install -r requirements-dev.txt
python -m pytest -q
```

## 注意

- SQLite 檔案在 compose 的 `accounting_data` volume（容器內 `/data/bot.sqlite3`），請納入備份。
- nginx 只轉送 `/line/accounting/callback`；`/healthz` 與 `/cron/daily-reminder` 不對外開放。
- 容器只跑 1 個 gunicorn worker，因為排程執行緒每個 worker 各一個。
