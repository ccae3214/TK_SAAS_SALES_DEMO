# 網頁安全性檢查報告

本報告針對您的電商 DEMO 專案進行了全面的安全性分析，涵蓋伺服器配置、前端代碼、API 請求、資料庫連接及身份驗證機制。

## 1. 伺服器與 Docker 配置安全性

### 檢查結果：
*   **Nginx 配置**：目前使用 Nginx 作為反向代理，配置了基本的 Gzip 壓縮和請求轉發。
*   **傳輸加密**：目前僅使用 **HTTP (Port 80)**，所有傳輸數據（包括使用者登入資訊、訂單詳情等）皆為明文傳輸，極易受到中間人攻擊 (MITM)。
*   **安全標頭**：缺乏 `Content-Security-Policy` (CSP)、`X-Frame-Options`、`X-Content-Type-Options` 等安全標頭。

### 改進建議：
*   **啟用 HTTPS**：強烈建議使用 Let's Encrypt 部署 SSL 憑證，並將所有 HTTP 請求重定向至 HTTPS。
*   **添加安全標頭**：在 Nginx 配置中加入以下標頭：
    ```nginx
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;";
    ```

## 2. API 請求安全性

### 檢查結果：
*   **CSRF 保護**：API 實作了 `requireCsrf` 檢查，驗證 `x-csrf-token` 標頭與 Cookie 中的 `csrf-token` 是否一致，能有效防止跨站請求偽造。
*   **身份驗證檢查**：關鍵 API（如訂單建立）使用了 `requireUser` 確保請求來自已登入的使用者。
*   **伺服器端驗證**：在建立訂單時，後端會根據資料庫中的產品價格重新計算總額，防止前端惡意篡改價格。

### 改進建議：
*   **速率限制 (Rate Limiting)**：目前 API 缺乏速率限制，容易受到暴力破解或拒絕服務攻擊 (DoS)。建議在 Nginx 或應用程式層級加入速率限制。

## 3. 資料庫連線安全性

### 檢查結果：
*   **SQL 注入防護**：專案使用了 `pg` 套件的參數化查詢（如 `query('SELECT * FROM users WHERE email = $1', [email])`），這能有效防止 SQL 注入攻擊。
*   **連線字串管理**：`docker-compose.yml` 中包含硬編碼的資料庫密碼，這在版本控制系統中存在洩漏風險。

### 改進建議：
*   **環境變數管理**：將敏感資訊（如 `POSTGRES_PASSWORD`、`DATABASE_URL`）移至 `.env` 檔案，並確保該檔案被加入 `.gitignore`。

## 4. 身份驗證機制安全性

### 檢查結果：
*   **NextAuth 整合**：使用了成熟的 NextAuth 框架，支援 JWT 策略和 OIDC (Google) 登入，安全性良好。
*   **密鑰管理**：`NEXTAUTH_SECRET` 目前有預設值，在生產環境中必須更換為強隨機字串。

### 改進建議：
*   **強化 Session 安全**：確保 `NEXTAUTH_SECRET` 在生產環境中是唯一的且足夠複雜。

---

## 總結與優先順序建議

| 項目 | 優先順序 | 說明 |
| :--- | :--- | :--- |
| **啟用 HTTPS** | **最高** | 防止明文傳輸敏感數據。 |
| **更換生產環境密鑰** | **高** | 確保身份驗證 Token 的不可偽造性。 |
| **隱藏敏感資訊** | **中** | 防止原始碼洩漏導致資料庫被攻破。 |
| **添加安全標頭** | **中** | 防禦常見的 Web 攻擊（如 XSS、Clickjacking）。 |

---
*本報告由 Manus AI 安全檢查工具生成，僅供參考。*
