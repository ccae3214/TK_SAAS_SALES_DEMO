# PROJECT_MAP｜TK SaaS Sales Demo 專案地圖

2026-11-10：B 候選已重新通過 Node 19 項、重建後 Chromium 20 項及 Docker build；使用者授權建立 feature → main PR，不合併、不部署。下方未提交／未發佈為前輪快照，發佈及 CI 以 GitHub PR 為準；驗證看 VERIFICATION_REPORT.md。

盤點日期：2026-11-05。已將 origin/main 快轉整合至本機 wei，基準 commit：`e939b40ee27c21746b106f784502061fa939db8e`。本輪配置另在 `feature/local-review-onboarding`，未 commit／push。
本文件描述實際檔案與程式責任，不代表所有功能已通過正式驗收。最新本機啟動、環境變數、畫面與配對實測只看 [LOCAL_REVIEW.md](LOCAL_REVIEW.md)，進度看 [TASK_LOG.md](TASK_LOG.md)，唯一計畫看 [ROADMAP.md](ROADMAP.md)，本輪 B 的完整證據看 [VERIFICATION_REPORT.md](VERIFICATION_REPORT.md)。[COMPARISON_WITH_LINE_HR_PILOT.md](COMPARISON_WITH_LINE_HR_PILOT.md) 是 ed3c2ab 的合併前比較快照。

## 1. 專案定位與技術架構

這是一個 Next.js App Router 的多模組網站，包含品牌展示、商店 Demo、管理後台、筆記與克雷迅人力仲介管理；不是 line-hr-pilot 的原目錄結構。

- 前端：React 19、Next.js 15、Tailwind、CSS Modules、Framer Motion、Recharts。
- HTTP／網站：`server.js` 以自訂 Node HTTP server 啟動 Next，另提供 Socket.IO Demo 事件。
- 身分：`src/auth.js` 使用 Auth.js／NextAuth，支援 Email 密碼、條件式 Google 與 LINE Login；JWT session。
- 資料庫：`src/lib/db.js` 的 pg Pool；Docker PostgreSQL 16，並非 Neon adapter。
- HR：管理者、worker、employer、agency；agency 再依 taiwan／philippines 分工。main 另有 admin_scope none／agency／system。角色政策集中度不足，仍須逐 action 核對；agency admin 尚未完整驗收。
- 文件：伺服器檢查 PDF／PNG／JPEG 檔頭與 10 MB 限制，以 AES-256-GCM 加密後存 PostgreSQL。金鑰由環境提供，未設定時上傳拒絕服務。
- HR 語言：目前切換 zh／en，不是原專案的三語完整替代。

## 2. 網頁入口

| 網址 | 檔案 | 用途 |
| --- | --- | --- |
| `/` | `src/app/page.jsx` | 品牌／多產品展示首頁 |
| `/hr/login` | `src/app/hr/login/page.jsx` | 人力會員登入 |
| `/hr` | `src/app/hr/page.jsx` | 依 session 顯示管理端或會員端 |
| `/admin` | `src/app/admin/page.jsx` | 商店等一般管理後台，勿與 HR 管理端混淆 |
| `/notes` | `src/app/notes/page.jsx` | 站內筆記 |
| `/checkout` | `src/app/checkout/page.jsx` | 商店結帳展示 |
| `/demo/corporate`、`/demo/creative`、`/demo/ecommerce`、`/demo/saas` | `src/app/demo/*/page.jsx` | 不同類型網站展示 |

## 3. 人力管理主要閱讀順序

1. `src/app/hr/page.jsx`：頁面身分分流。
2. `src/auth.js`、`src/lib/hr-access.js`、`src/lib/security.js`：登入、主體查詢、管理白名單與保護函式；不要只根據 UI 判斷權限。
3. `src/app/api/hr/route.js`：schema 初始化、資料查詢、雇主需求、台灣仲介派單、菲律賓仲介提名、雇主面試、正式案件、必要文件、審核、程序、待辦與會員管理。
4. `src/components/HrManagement.jsx`：HR 管理畫面；`HrAgencyDirectory.jsx` 為仲介搜尋／台菲篩選與授權資料關係總覽。
5. `src/components/HrMemberPortal.jsx`：worker／employer／agency 畫面、履歷與配工操作；B 版預設工作起點、獨立配對／人員分頁。`HrJourney.jsx`／`HrJourney.module.css` 負責工作起點、五階段配對與新會員指引；`src/lib/hr-workflow.js` 為純呈現狀態投影，不授予權限。
6. `src/app/api/hr/documents/route.js`、`src/app/api/hr/documents/[submissionId]/route.js`：上傳、加密、授權解密、下載稽核。
7. `src/app/api/hr/chat/route.js`、`src/components/HrChat.jsx`：機構群組、案件群組、私訊、未讀與已讀。
8. `src/lib/hr-line-bot.js`、`src/app/api/line/webhook/route.js`：LINE 查詢、Flex 網站入口、簽章、事件去重與 Reply。
9. `src/components/PersonNameFields.jsx`：main 新增的中英文姓名欄位共用元件。
10. `src/lib/hr-translations.jsx`、`src/components/HrReminders.jsx`：中英翻譯、待辦提醒；頁面提醒不是可靠的 LINE Push 工作佇列。

## 4. API 分區

- `/api/hr`：主要 HR GET／POST／PATCH／DELETE 多 action 入口。
- `/api/hr/member-request`：登入會員申請類型，待管理者指派。
- `/api/hr/documents`、`/api/hr/documents/[submissionId]`：文件傳入／傳出。
- `/api/hr/workers/[id]/resume-photo`：履歷照片獨立讀取。
- `/api/hr/chat`：聊天與閱讀狀態。
- `/api/line/webhook`：Messaging API 入口；不同於 LINE Login callback。
- `/api/auth/[...nextauth]`、`/api/auth/line-user-id`：Auth.js handlers／本人 LINE 識別查詢。
- `/api/products`、`/api/cart`、`/api/orders`、`/api/coupons`、`/api/reviews`、`/api/wishlist`：商店資料。
- `/api/users`、`/api/users/login`、`/api/users/register`：另一組商店會員端點，不能直接視為 HR 認證同一套政策。
- `/api/news`、`/api/inquiries`、`/api/admin/dashboard`：內容、聯絡與一般管理。
- `/api/notes`、`/api/notes/folders`：站內筆記。
- `/api/csrf`：CSRF token 端點；HR 多處另有自己的 Origin 檢查。

## 5. 資料模型與初始化邊界

`init.sql` 負責商店等初始資料表，不是 HR schema 的唯一來源。

- 人與機構：`hr_employers`、`hr_workers`（履歷 JSONB）、`hr_staff`、`hr_agencies`、`hr_members`。
- 配工：`hr_job_orders` → `hr_job_order_agencies` → `hr_job_order_routes` → `hr_job_order_candidates` → `hr_cases`。
- 辦件：`hr_case_requirements` → `hr_document_submissions` → `hr_document_files`／`hr_document_reviews`。
- 工作進度：`hr_case_tasks`、`hr_case_activity`、`hr_application_steps`。
- 聊天：`hr_chat_rooms`、`hr_chat_messages`、`hr_chat_participants`、`hr_chat_reads`。
- LINE：`hr_line_webhook_events`。

主要 DDL 位於 `src/app/api/hr/route.js` 的 `ensureSchema()`、`src/lib/hr-access.js` 的 `ensureHrIdentitySchema()`、聊天 `ensureRooms()` 及 Webhook handler。某些已登入 GET 也會執行 DDL／資料更新，不是純讀取。啟動後的登入驗收前須先確認隔離資料庫與 schema 授權。

`scripts/seed-hr-role-tests.js` 是會建立／修改 schema、寫入測試人物及重設測試密碼的 seed，不是無副作用的測試套件；已於本輪經明確授權的隔離 DB 由 `scripts/local-review-bootstrap.mjs` 呼叫，並立即用隨機密碼取代 seed 固定密碼；禁止直接對正式 DB 執行。

## 6. Docker 與外部依賴

- `compose.review.yaml`：本輪隔離的 app／PostgreSQL；網站 localhost:8088，資料庫不發布主機 port，不啟動 DDNS／外部 notebook。
- `scripts/local-review-bootstrap.mjs`：限定 review DB 的 schema／虛構人物初始化，已有會員即拒絕重灌；需明確授權。
- `.env.review.local`（本機忽略檔，不進索引）：隨機 DB／登入／文件密鑰與虛構帳號密碼；現有 Git／Docker .env.* 規則排除。
- `Dockerfile`：node:20-alpine，npm ci → next build → standalone＋自訂 server，以 nextjs 非 root 使用者執行。
- `docker-compose.yml`：postgres、app、notebook、cloudflare-ddns、nginx。
- app 對主機 8080；postgres 對主機 5432；nginx 為 HTTP 80；notebook 綁 loopback 8787。
- notebook 的 build context／env_file 指向 repo 外 `../../New project/notebook_app`，單獨 clone 不包含該專案。
- cloudflare-ddns 是會操作外部 DNS 的服務，不應為了本機看畫面就直接啟動整組。
- `nginx.conf`：網站、Socket.IO、外部 notebook 的反向代理；目前未見 443 server block。
- `HTTPS_SETUP.md`／`scripts/init-certbot.*` 保留 TLS 設定說明與腳本，但現行 Compose 沒有 certbot service，須與 README 分開核對。
- `.env.example`：僅供欄位參考；不要把真實值寫入 docs 或 Git。

## 7. 文件與驗證入口

- `README.md`：已增加唯一有效本機入口；下方既有 TLS／Fly.io／Windows 操作描述不作本輪啟動依據。
- `docs/LOCAL_REVIEW.md`：本輪本機驗收、帳號讀取、環境變數、優化選項與未驗清單。
- `docs/TASK_LOG.md`：合併、啟動與 B 三流程整理紀錄。
- `docs/ROADMAP.md`：B 的確認範圍、驗收與非目標，唯一計畫主檔。
- `docs/VERIFICATION_REPORT.md`：19 項 Node／20 項 Chromium 與 build 實際證據。
- `tests/hr-workflow.test.mjs`：Node 內建測試執行器，無外部依賴的工作流程投影測試。
- `scripts/verify-local-review.py`：獨立 Playwright Python 環境執行；限定本機 review Docker project，建立虛構 fixture、以六角色測實際 UI 及讀回資料。
- `docs/review/*.png`：實際 Chromium 虛構人物畫面截圖。
- `.github/workflows/ci.yml`、`.github/workflows/deploy.yml`、`.github/pull_request_template.md`：main 帶入的 CI／部署／PR 設定；本輪未 push 或觸發部署。
- `HTTPS_SETUP.md`：歷史 HTTPS 指南。
- `NOTES_INTEGRATION.md`：筆記整合說明。
- `SECURITY_HARDENING.md`、`security_report.md`：既有安全紀錄，不是本輪驗收證據。
- `docs/PROJECT_MAP.md`：本地圖。
- `docs/COMPARISON_WITH_LINE_HR_PILOT.md`：合併前 ed3c2ab 的差異與安全發現歷史快照。
- `scripts/deploy-verify.ps1`：既有 PowerShell 驗證流程；本輪未在 Windows 執行。
- `package.json`：build／lint／docker scripts；目前沒有 test script。
- `eslint.config.js`：仍含 Vite／React Refresh 風格規則；build 另設定跳過 lint／型別驗證。

## 8. 追蹤與待提交檔案完整索引

目前來源 commit 有 133 個追蹤檔，另列本機未提交的新檔，共 157 個。忽略的 secrets 不列入；`certs/` 既有追蹤私鑰仍待擁有者處理，不可複製內容。

| 路徑 | 責任分類 |
| --- | --- |
| `.dockerignore` | 建置／工具／Docker／版本控制設定 |
| `.env.example` | 建置／工具／Docker／版本控制設定 |
| `.gitattributes` | 建置／工具／Docker／版本控制設定 |
| `.github/pull_request_template.md` | main 帶入的 CI／部署／PR 設定 |
| `.github/workflows/ci.yml` | main 帶入的 CI／部署／PR 設定 |
| `.github/workflows/deploy.yml` | main 帶入的 CI／部署／PR 設定 |
| `.gitignore` | 建置／工具／Docker／版本控制設定 |
| `Dockerfile` | 建置／工具／Docker／版本控制設定 |
| `HTTPS_SETUP.md` | 既有操作／安全／整合文件 |
| `NOTES_INTEGRATION.md` | 既有操作／安全／整合文件 |
| `README.md` | 既有操作／安全／整合文件 |
| `SECURITY_HARDENING.md` | 既有操作／安全／整合文件 |
| `certbot_www/.gitkeep` | 建置／工具／Docker／版本控制設定 |
| `certs/accounts/acme-v02.api.letsencrypt.org/directory/2c9186340c344d0da960964718d441b5/meta.json` | ACME 帳號資料（敏感；需由擁有者評估處理） |
| `certs/accounts/acme-v02.api.letsencrypt.org/directory/2c9186340c344d0da960964718d441b5/private_key.json` | ACME 帳號資料（敏感；需由擁有者評估處理） |
| `certs/accounts/acme-v02.api.letsencrypt.org/directory/2c9186340c344d0da960964718d441b5/regr.json` | ACME 帳號資料（敏感；需由擁有者評估處理） |
| `compose.review.yaml` | 隔離本機 Docker 配置，不啟動外部服務 |
| `docker-compose.yml` | 建置／工具／Docker／版本控制設定 |
| `docs/COMPARISON_WITH_LINE_HR_PILOT.md` | 本輪專案地圖／比較報告 |
| `docs/LOCAL_REVIEW.md` | 目前有效的本機操作／環境變數／實測與優化選項 |
| `docs/PROJECT_MAP.md` | 本輪專案地圖／比較報告 |
| `docs/ROADMAP.md` | B 三流程唯一計畫主檔 |
| `docs/TASK_LOG.md` | 合併與啟動工作紀錄 |
| `docs/VERIFICATION_REPORT.md` | B 實際測試與未驗界線 |
| `docs/review/admin-agencies.png` | Chromium 實際畫面截圖（僅虛構人物） |
| `docs/review/b-agency-directory.png` | B 實際 Chromium 畫面截圖（虛構人物） |
| `docs/review/b-employer-matching.png` | B 實際 Chromium 畫面截圖（虛構人物） |
| `docs/review/b-new-member-choose.png` | B 實際 Chromium 畫面截圖（虛構人物） |
| `docs/review/b-new-member-waiting.png` | B 實際 Chromium 畫面截圖（虛構人物） |
| `docs/review/b-philippines-mobile.png` | B 實際 Chromium 畫面截圖（虛構人物） |
| `docs/review/b-taiwan-mobile.png` | B 實際 Chromium 畫面截圖（虛構人物） |
| `docs/review/employer-matching.png` | Chromium 實際畫面截圖（僅虛構人物） |
| `docs/review/new-member.png` | Chromium 實際畫面截圖（僅虛構人物） |
| `docs/review/taiwan-matching.png` | Chromium 實際畫面截圖（僅虛構人物） |
| `eslint.config.js` | 建置／工具／Docker／版本控制設定 |
| `google-login-fix.patch` | 歷史登入修正 patch（目前仍追蹤） |
| `init.sql` | PostgreSQL 初始化 SQL（會寫 schema／資料） |
| `jsconfig.json` | 建置／工具／Docker／版本控制設定 |
| `next.config.js` | 建置／工具／Docker／版本控制設定 |
| `nginx.conf` | 建置／工具／Docker／版本控制設定 |
| `package-lock.json` | 建置／工具／Docker／版本控制設定 |
| `package.json` | 建置／工具／Docker／版本控制設定 |
| `postcss.config.cjs` | 建置／工具／Docker／版本控制設定 |
| `public/corporate_innovation.png` | 公開靜態素材／PWA／Service Worker |
| `public/corporate_team.png` | 公開靜態素材／PWA／Service Worker |
| `public/corporate_ui.png` | 公開靜態素材／PWA／Service Worker |
| `public/creative_ui.png` | 公開靜態素材／PWA／Service Worker |
| `public/ecommerce_ui.png` | 公開靜態素材／PWA／Service Worker |
| `public/favicon.svg` | 公開靜態素材／PWA／Service Worker |
| `public/icons.svg` | 公開靜態素材／PWA／Service Worker |
| `public/manifest.json` | 公開靜態素材／PWA／Service Worker |
| `public/notes-sw.js` | 公開靜態素材／PWA／Service Worker |
| `public/offline.html` | 公開靜態素材／PWA／Service Worker |
| `public/saas_ui.png` | 公開靜態素材／PWA／Service Worker |
| `public/sw.js` | 公開靜態素材／PWA／Service Worker |
| `public/workbox-4754cb34.js` | 公開靜態素材／PWA／Service Worker |
| `scripts/deploy-verify.ps1` | 操作／初始化／測試資料腳本（先檢查副作用） |
| `scripts/init-certbot.ps1` | 操作／初始化／測試資料腳本（先檢查副作用） |
| `scripts/init-certbot.sh` | 操作／初始化／測試資料腳本（先檢查副作用） |
| `scripts/local-review-bootstrap.mjs` | 限定空白隔離 DB 的 schema／虛構人物初始化 |
| `scripts/notes-schema.sql` | 操作／初始化／測試資料腳本（先檢查副作用） |
| `scripts/seed-hr-role-tests.js` | 操作／初始化／測試資料腳本（先檢查副作用） |
| `scripts/verify-local-review.py` | 限定本機隔離資料的 Chromium UI／API 讀回驗收 |
| `security_report.md` | 既有操作／安全／整合文件 |
| `server.js` | Next 自訂 HTTP server／Socket.IO Demo |
| `src/AuthContext.jsx` | 前端身分／語言狀態（存在兩個 AuthContext 路徑） |
| `src/app/admin/page.jsx` | App Router 網頁／共用版型與樣式 |
| `src/app/api/admin/dashboard/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/auth/[...nextauth]/route.js` | Auth.js／LINE 身分入口 |
| `src/app/api/auth/line-user-id/route.js` | Auth.js／LINE 身分入口 |
| `src/app/api/cart/[email]/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/cart/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/coupons/[id]/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/coupons/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/coupons/verify/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/csrf/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/hr/chat/route.js` | HR API／schema／授權與流程 |
| `src/app/api/hr/documents/[submissionId]/route.js` | HR API／schema／授權與流程 |
| `src/app/api/hr/documents/route.js` | HR API／schema／授權與流程 |
| `src/app/api/hr/member-request/route.js` | HR API／schema／授權與流程 |
| `src/app/api/hr/route.js` | HR API／schema／授權與流程 |
| `src/app/api/hr/workers/[id]/resume-photo/route.js` | HR API／schema／授權與流程 |
| `src/app/api/inquiries/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/line/webhook/route.js` | LINE Messaging Webhook |
| `src/app/api/news/[id]/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/news/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/notes/[id]/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/notes/folders/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/notes/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/orders/[id]/status/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/orders/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/orders/user/[email]/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/products/[id]/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/products/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/reviews/[id]/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/reviews/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/users/login/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/users/register/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/users/route.js` | 商店／筆記／一般網站 API |
| `src/app/api/wishlist/[email]/route.js` | 商店／筆記／一般網站 API |
| `src/app/checkout/page.jsx` | App Router 網頁／共用版型與樣式 |
| `src/app/demo/corporate/page.jsx` | App Router 網頁／共用版型與樣式 |
| `src/app/demo/creative/page.jsx` | App Router 網頁／共用版型與樣式 |
| `src/app/demo/ecommerce/page.jsx` | App Router 網頁／共用版型與樣式 |
| `src/app/demo/saas/page.jsx` | App Router 網頁／共用版型與樣式 |
| `src/app/globals.css` | App Router 網頁／共用版型與樣式 |
| `src/app/hr/login/page.jsx` | App Router 網頁／共用版型與樣式 |
| `src/app/hr/page.jsx` | App Router 網頁／共用版型與樣式 |
| `src/app/layout.jsx` | App Router 網頁／共用版型與樣式 |
| `src/app/notes/page.jsx` | App Router 網頁／共用版型與樣式 |
| `src/app/page.jsx` | App Router 網頁／共用版型與樣式 |
| `src/app/providers.jsx` | App Router 網頁／共用版型與樣式 |
| `src/assets/hero.png` | 前端資料／樣式／靜態素材／工具 |
| `src/assets/react.svg` | 前端資料／樣式／靜態素材／工具 |
| `src/assets/vite.svg` | 前端資料／樣式／靜態素材／工具 |
| `src/auth.js` | 前端資料／樣式／靜態素材／工具 |
| `src/components/AdminDashboard.jsx` | 網站／商店／筆記共用 UI |
| `src/components/CheckoutPage.jsx` | 網站／商店／筆記共用 UI |
| `src/components/ContactModal.jsx` | 網站／商店／筆記共用 UI |
| `src/components/CorporateDemo.jsx` | 網站／商店／筆記共用 UI |
| `src/components/CreativeDemo.jsx` | 網站／商店／筆記共用 UI |
| `src/components/DemoOverlay.jsx` | 網站／商店／筆記共用 UI |
| `src/components/EcommerceDemo.jsx` | 網站／商店／筆記共用 UI |
| `src/components/ErrorBoundary.jsx` | 網站／商店／筆記共用 UI |
| `src/components/HrAgencyDirectory.jsx` | 仲介搜尋／篩選與機構詳情 |
| `src/components/HrChat.jsx` | 人力管理／會員／聊天／提醒 UI |
| `src/components/HrChat.module.css` | 人力管理／會員／聊天／提醒 UI |
| `src/components/HrJourney.jsx` | 角色工作起點／五階段需求／會員選角與待審指引 |
| `src/components/HrJourney.module.css` | 工作起點／新會員／仲介目錄響應式樣式 |
| `src/components/HrManagement.jsx` | 人力管理／會員／聊天／提醒 UI |
| `src/components/HrManagement.module.css` | 人力管理／會員／聊天／提醒 UI |
| `src/components/HrMemberPortal.jsx` | 人力管理／會員／聊天／提醒 UI |
| `src/components/HrReminders.jsx` | 人力管理／會員／聊天／提醒 UI |
| `src/components/HrReminders.module.css` | 人力管理／會員／聊天／提醒 UI |
| `src/components/MemberMenu.jsx` | 網站／商店／筆記共用 UI |
| `src/components/NotesWorkspace.jsx` | 網站／商店／筆記共用 UI |
| `src/components/NotesWorkspace.module.css` | 網站／商店／筆記共用 UI |
| `src/components/OrderSuccess.jsx` | 網站／商店／筆記共用 UI |
| `src/components/PageHeader.jsx` | 網站／商店／筆記共用 UI |
| `src/components/PersonNameFields.jsx` | 中英姓名共用欄位 |
| `src/components/SaasDemo.jsx` | 網站／商店／筆記共用 UI |
| `src/components/VideoModal.jsx` | 網站／商店／筆記共用 UI |
| `src/context/AuthContext.jsx` | 前端身分／語言狀態（存在兩個 AuthContext 路徑） |
| `src/context/LanguageContext.jsx` | 前端身分／語言狀態（存在兩個 AuthContext 路徑） |
| `src/data/translations.js` | 前端資料／樣式／靜態素材／工具 |
| `src/index.css` | 前端資料／樣式／靜態素材／工具 |
| `src/lib/db.js` | 資料存取／認證／安全／HR 共用邏輯 |
| `src/lib/hr-access.js` | 資料存取／認證／安全／HR 共用邏輯 |
| `src/lib/hr-line-bot.js` | 資料存取／認證／安全／HR 共用邏輯 |
| `src/lib/hr-translations.jsx` | 資料存取／認證／安全／HR 共用邏輯 |
| `src/lib/hr-workflow.js` | 純呈現的會員狀態／配對階段／機構關係投影 |
| `src/lib/linePostgres.js` | 資料存取／認證／安全／HR 共用邏輯 |
| `src/lib/passwords.js` | 資料存取／認證／安全／HR 共用邏輯 |
| `src/lib/security.js` | 資料存取／認證／安全／HR 共用邏輯 |
| `src/utils/orderUtils.js` | 前端資料／樣式／靜態素材／工具 |
| `tailwind.config.cjs` | 建置／工具／Docker／版本控制設定 |
| `tests/hr-workflow.test.mjs` | 19 項 Node 流程投影與 pending 旗標測試 |
