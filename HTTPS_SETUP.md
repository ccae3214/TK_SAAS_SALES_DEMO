# HTTPS 與 Let's Encrypt 自動化部署指南

本項目使用 **Certbot + Docker** 實現自動化 HTTPS 證書管理。

## 架構概覽

```
┌─────────────┐
│  Nginx      │  Port 80 (HTTP)  → 重定向至 HTTPS
│  + Nginx    │  Port 443 (HTTPS) → 代理至 Node.js app
└──────┬──────┘
       │
       ├─ /etc/letsencrypt (掛載卷)
       └─ /var/www/certbot (ACME 驗證)
           │
           └─ Certbot Service
              • 首次：取得證書
              • 日常：每 24 小時檢查一次續期
              • 自動：無停機續期
```

## 快速開始

### 1️⃣ 設置環境變數

編輯 `.env` 檔案：

```env
LETSENCRYPT_EMAIL=admin@yourdomain.com
LETSENCRYPT_DOMAIN=yourdomain.com
POSTGRES_PASSWORD=your_secure_password_here
NEXTAUTH_SECRET=your_long_random_secret_here
```

**重要**：
- `LETSENCRYPT_DOMAIN` 必須是真實的公網域名
- 確保 DNS 已指向您的伺服器 IP

### 2️⃣ 首次初始化（取得證書）

#### Windows (PowerShell):
```powershell
PS> .\scripts\init-certbot.ps1
```

或指定域名和信箱：
```powershell
PS> .\scripts\init-certbot.ps1 -Domain yourdomain.com -Email admin@yourdomain.com
```

#### Linux/macOS (Bash):
```bash
$ bash ./scripts/init-certbot.sh
```

此腳本會：
1. 啟動 Nginx（允許 ACME 驗證）
2. 執行 Certbot 首次證書取得
3. 自動更新 `nginx.conf` 中的証書路徑
4. 重新載入 Nginx 設定

### 3️⃣ 啟動完整堆棧

```powershell
docker-compose up -d
```

驗證所有服務正在運行：
```powershell
docker-compose ps
```

### 4️⃣ 驗證 HTTPS

訪問 `https://yourdomain.com`

檢查：
- ✅ 瀏覽器顯示「連線安全」（綠色鎖定）
- ✅ 憑證由 Let's Encrypt 簽發
- ✅ HTTP (`http://yourdomain.com`) 自動重定向至 HTTPS

---

## 文件結構

```
.
├── docker-compose.yml          # 包含 Nginx + Certbot 服務定義
├── nginx.conf                  # Nginx 設定（含 ACME 路由）
├── certs/                      # 憑證存儲位置（Docker 卷掛載）
│   └── live/
│       └── yourdomain.com/
│           ├── cert.pem        # 伺服器憑證
│           ├── privkey.pem     # 私鑰
│           ├── chain.pem       # 中繼憑證
│           └── fullchain.pem   # 完整鏈
├── certbot_www/                # ACME 驗證臨時目錄
├── scripts/
│   ├── init-certbot.ps1        # Windows 初始化腳本
│   └── init-certbot.sh         # Linux/macOS 初始化腳本
├── .env                        # 環境變數（.gitignore 已排除）
└── .env.example                # 環境變數範本
```

---

## 日常維運

### 檢查證書狀態

```powershell
docker-compose exec certbot certbot certificates
```

### 查看 Certbot 日誌

```powershell
docker-compose logs -f certbot
```

### 手動觸發續期（通常不需要）

```powershell
docker-compose run --rm certbot renew
```

### 檢查 Nginx 配置

```powershell
docker-compose exec -T nginx nginx -T
```

### 重新載入 Nginx（無停機）

```powershell
docker-compose exec -T nginx nginx -s reload
```

---

## 安全標頭

Nginx 已配置以下安全標頭：

| 標頭 | 作用 |
|------|------|
| `Strict-Transport-Security` | 強制 HTTPS（2 年） |
| `Content-Security-Policy` | 防止 XSS 攻擊 |
| `X-Frame-Options` | 防止點擊劫持 |
| `X-Content-Type-Options` | 防止 MIME 嗅探 |
| `X-XSS-Protection` | 瀏覽器 XSS 保護 |
| `Referrer-Policy` | 限制轉介資訊洩漏 |
| `Permissions-Policy` | 限制瀏覽器權限 |

---

## 故障排查

### ❌ 證書取得失敗

**症狀**：`docker-compose run --rm certbot` 失敗

**常見原因**：
1. DNS 未指向伺服器（ACME 驗證失敗）
2. 防火牆阻止 port 80 或 443
3. 域名被 Let's Encrypt 暫時限流

**解決**：
```powershell
# 檢查 DNS
nslookup yourdomain.com

# 檢查埠開放性
Test-NetConnection -ComputerName yourdomain.com -Port 80
Test-NetConnection -ComputerName yourdomain.com -Port 443

# 查看詳細日誌
docker-compose logs -f certbot
docker-compose logs -f nginx
```

### ❌ 混合內容警告（Mixed Content）

**症狀**：HTTPS 頁面載入 HTTP 資源

**原因**：應用程式代碼中有 `http://` 流量

**解決**：
- 檢查 `NEXTAUTH_URL` 和 `APP_ORIGIN` 環境變數
- 確保使用 `https://` 前綴
- 檢查瀏覽器開發者工具的「網路」標籤

### ❌ ERR_CERT_AUTHORITY_INVALID

**症狀**：瀏覽器不信任憑證

**原因**：證書未正確掛載或 nginx.conf 中路徑錯誤

**解決**：
```powershell
# 驗證卷掛載
docker-compose exec nginx ls -la /etc/letsencrypt/live/yourdomain.com/

# 檢查 nginx 配置
docker-compose exec -T nginx nginx -T
```

---

## 高級配置

### 自訂 Nginx 安全標頭

編輯 `nginx.conf` 中的 `add_header` 行。全部清單見 [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)

### 多個域名

修改 `.env`：
```env
LETSENCRYPT_DOMAIN=yourdomain.com,www.yourdomain.com
```

修改 `docker-compose.yml` certbot command：
```yaml
command: >
  certonly
  --webroot
  --webroot-path=/var/www/certbot
  --email ${LETSENCRYPT_EMAIL}
  --agree-tos
  -d yourdomain.com
  -d www.yourdomain.com
```

### 通配符憑證（Wildcard）

可選使用 DNS 驗證取得 `*.yourdomain.com`（需要編輯 certbot 命令）

---

## 更新和維護

### 更新 Certbot 映像

```powershell
docker pull certbot/certbot:latest
docker-compose up -d --pull always
```

### 檢查日誌中的警告

```powershell
docker-compose logs certbot | Select-String Warning
```

---

## 資源連結

- [Let's Encrypt 官網](https://letsencrypt.org/)
- [Certbot 文檔](https://certbot.eff.org/docs/using.html)
- [Nginx HTTPS 最佳實踐](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [SSL/TLS 測試工具](https://www.ssl-tools.net/)

---

## 許可證和成本

✅ **Let's Encrypt 完全免費**（無需支付任何費用）

⚠️ **速率限制**：
- 每個域名每週最多 50 個證書
- 每個域名每週最多 5 個重複證書
- 我們的自動續期機制每 24 小時檢查一次，不會超出限制

---

**上次更新**：2026-04-07  
**維護者**：TK SaaS Sales Demo Team
