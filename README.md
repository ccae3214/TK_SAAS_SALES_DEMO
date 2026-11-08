# TK SaaS Sales Demo

## 克雷迅人力管理

`/hr` 是克雷迅人力仲介管理系統，資料儲存在 Docker PostgreSQL，不載入範例案件。可管理雇主／客戶、工作者、承辦人、案件、文件上傳與審核、體檢訓練進度及工作待辦。必要文件屬於工作者、不屬於案件：工作者一建立就會有 22 項文件清單（含上傳、審核、補件紀錄），之後不論配到哪個雇主、有幾個案件都共用同一份，不必重傳。其中「新護照」與「PSA出生證明（附收據）」是前置文件，兩者核准後才能安排體檢及訓練；其餘文件（含體檢 Medical）與體檢、訓練同步追蹤。7 項條件式文件（PSA 結婚證明、子女 PSA 出生證明、CENOMAR、ARC、Health Card、DMW Info Sheet、出生逾 10 年補登證明）會依工作者履歷（婚姻狀況、子女人數、海外／台灣工作經歷）自動判斷是否適用；履歷資訊不足或無法推導的（如補登證明）預設不適用，由仲介覆核。仲介手動調整過的適用狀態不會被自動覆寫，履歷更新時只會重新套用尚未收件、且未經手動調整的文件。案件只會依職類多出「必備證照」（例如家庭看護、機構看護工需要 Caregiving NC2），工作者還沒有證照時，用「未開始→訓練中→考照中→已取得」追蹤取證進度，證照取得前案件不會進入完成階段。

## Docker Deploy Verify

Run the full containerized verification flow:

```powershell
npm run docker:verify
```

The script will:

1. Build the Docker images
2. Recreate the containers
3. Verify the homepage responds with `200`
4. Verify `/api/products` responds with `200`
5. Verify `/api/admin/dashboard` responds with `401` when unauthenticated
6. Print recent app logs

Environment variables used by Docker verification:

- `NEXTAUTH_URL`
- `APP_ORIGIN`
- `NEXTAUTH_SECRET`
- `ADMIN_EMAILS`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `OIDC_ISSUER`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`

If they are not already set, the script falls back to safe local verification defaults.

## Secure environment configuration

This project uses an `.env` file for sensitive values so they are not hard-coded in `docker-compose.yml`.

- Keep `.env` out of version control.
- `.gitignore` already excludes `.env` and `.env.*`.
- Use `.env.example` as a template for production values.

## HTTPS and TLS with Let's Encrypt

The docker-compose stack includes automatic certificate management via **Certbot**.

### Automated HTTPS Setup

1. **Configure environment variables** in `.env`:
   ```env
   LETSENCRYPT_EMAIL=your_email@example.com
   LETSENCRYPT_DOMAIN=yourdomain.com
   ```

2. **Run the initialization script** (one-time setup):
   ```powershell
   # Windows PowerShell
   .\scripts\init-certbot.ps1
   
   # Or specify domain/email as parameters
   .\scripts\init-certbot.ps1 -Domain yourdomain.com -Email you@example.com
   ```
   
   Or for Linux/macOS:
   ```bash
   bash ./scripts/init-certbot.sh
   ```

3. **Start the full stack**:
   ```powershell
   docker-compose up -d
   ```

### How It Works

- **Nginx** listens on ports 80 and 443; redirects HTTP → HTTPS
- **Certbot service** runs continuously and:
  - Automatically renews expiring certificates daily
  - Uses webroot validation (no downtime during renewal)
  - Stores certificates in Docker volume `letsencrypt`
- **ACME challenges** handled via `/.well-known/acme-challenge/` routing

### Certificate Locations

- **Inside containers**: `/etc/letsencrypt/live/{domain}/`
- **On host**: `./certs/live/{domain}/`

### Troubleshooting

Check Certbot logs:
```powershell
docker-compose logs certbot
```

Manually renew certificates:
```powershell
docker-compose run --rm certbot renew
```


## Fly.io Deploy

This project includes a starter [fly.toml](C:\Users\ccae3\Documents\GitHub\TK_SAAS_SALES_DEMO\fly.toml) for a single-machine Fly.io deployment with a persistent volume for SQLite.

Before first deploy:

1. Install and log in to `flyctl`
2. Change the `app` name in `fly.toml`
3. Update `APP_ORIGIN` and `NEXTAUTH_URL` in `fly.toml`
4. Create a volume in your target region:

```powershell
fly volumes create data --region hkg --size 5
```

5. Set secrets:

```powershell
fly secrets set NEXTAUTH_SECRET=your-long-random-secret ADMIN_EMAILS=you@example.com OIDC_CLIENT_ID=... OIDC_CLIENT_SECRET=... OIDC_ISSUER=https://accounts.google.com
```

6. Deploy:

```powershell
fly deploy
```

Fly volume and configuration references:

- [Fly app configuration docs](https://fly.io/docs/reference/configuration/)
- [Fly volumes docs](https://fly.io/docs/volumes/volume-manage/)
- [Fly SQLite guidance](https://fly.io/docs/js/prisma/sqlite/)

## LINE Messaging API 人力會員查詢

- Webhook URL：`https://kolecion.cc/api/line/webhook`，在 LINE Developers 的 Messaging API channel 啟用 Use webhook 並執行 Verify。
- `.env` 需設定 `LINE_MESSAGING_CHANNEL_SECRET` 與 `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`；這兩項來自 Messaging API channel，和 LINE Login channel 的 Client ID／Secret 不同。
- LINE 官方帳號只能設定一個 Webhook URL；將入口改為本系統後，無法辨識為人力會員問題的訊息會轉送至 `LINE_LEGACY_WEBHOOK_URL`（舊 Vercel Bot）處理，避免舊 Bot 流程中斷。
- Messaging API channel 與 LINE Login channel 必須位於同一個 LINE Provider，否則兩者的 LINE User ID 不同，無法對應 `hr_members.line_user_id`。
- Bot 支援「說明」、「我的案件／案件進度」、「文件／護照／PSA」、「體檢與訓練」、「待辦事項」等查詢；依會員角色限制查詢 PostgreSQL 資料，只支援官方帳號一對一聊天，不在群組回覆個人案件資料。
- 未綁定會員會收到登入與申請類型說明；尚待審核的會員只會看到審核狀態。Webhook 驗證失敗或資料未設定時不會提供會員資料。
- 修改 `.env` 後執行 `docker compose up -d --force-recreate app` 套用 Messaging API 設定。
