# TK SaaS Sales Demo

## 克雷迅人力管理

`/hr` 是克雷迅人力仲介管理系統，資料儲存在 Docker PostgreSQL，不載入範例案件。可管理雇主／客戶、工作者、承辦人、案件、文件上傳與審核、體檢訓練進度及工作待辦。新案件會建立護照資料頁與 PSA 出生證明前置文件，兩者核准後才能安排體檢及訓練；各必要文件、體檢與訓練同步追蹤。PDF、JPG、PNG 文件會以 AES-256-GCM 加密後儲存在 PostgreSQL，下載僅限管理者或該工人、雇主、仲介的關聯帳號，並寫入案件活動紀錄。請備份 `.env` 裡的 `HR_DOCUMENT_ENCRYPTION_KEY`；遺失金鑰後無法解密既有文件。管理者由 `ADMIN_EMAILS` 指定；如需用 LINE 登入管理者帳號，請先用該管理者的 LINE 登入，再開啟 `/api/auth/line-user-id` 取得 LINE User ID，將 ID 加入 `HR_ADMIN_LINE_USER_IDS` 後重啟 app 容器。會員登入後可申請工人、雇主或仲介類型；尚未指派類型的帳號會等待管理者審核並綁定所屬資料。管理者也可在會員帳號頁直接新增或變更類型。工人只讀取自己的案件、案件雇主與所屬仲介；雇主只讀取尚未媒合與已屬於自己的工人；仲介只讀取所屬仲介的工人、雇主與案件。LINE Login 需在 LINE Developers Console 建立 LINE Login channel，將 Channel ID 與 Channel secret 填入 `.env`，並登記回呼網址 `${NEXTAUTH_URL}/api/auth/callback/line`。

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
