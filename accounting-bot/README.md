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

- 每月 31 號的帳單在較短的月份會改在月底提醒。
- 已標記已付的帳單，當月不會再提醒；下個月會重新提醒。
- 每天推播具冪等性：同一天同一人不會收到重複訊息，推播失敗會在下次檢查時重試。
- 只處理 1 對 1 聊天，群組與聊天室會被忽略。

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
