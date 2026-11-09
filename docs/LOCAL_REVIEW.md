# LOCAL_REVIEW｜合併 main 後的本機驗收入口

目前 PR #12：https://github.com/ccae3214/TK_SAAS_SALES_DEMO/pull/12 。明確 fetch main 後確認最新 `f26ea46` 與 B 候選有 5 個內容衝突，先保留 Draft；local test 只涵蓋本 PR 舊基底候選，未完成最新 main 整合。最新 main 已刪除 `.github`，目前無 CI checks；下文 CI／部署 workflow 為舊基底歷史，需分開判讀。

## 2026-11-10 PR 的 local test

本輪已重新 build／僅重建 app，並完整重跑 Node 19 項、Chromium 20 項通過。不要為了驗 PR 啟動原部署 compose，不要重跑 bootstrap 或刪 volume。此頁下方先前的未 commit／push 是歷史狀態；PR 與 CI 以 GitHub 為準。

### Windows 瀏覽器手動驗收

1. 開啟 http://localhost:8088/hr/login；密碼只在本機 `.env.review.local` 的 `REVIEW_LOGIN_PASSWORD` 查看。
2. `review.admin@example.invalid`：仲介機構名稱搜尋、無結果、台菲篩選、展開成員／雇主／工人／需求與案件。
3. `test.employer01@example.com`：到需求與配對，建立虛構需求並分派台灣仲介。
4. 登出後以 `test.agency.tw@example.com` 轉交菲律賓仲介；再以 `test.agency.ph@example.com` 推薦可用虛構工人。若沒有可用工人，不要擅改真實資料，可由 Agent 在已授權隔離資料庫補測試 fixture。
5. 回雇主帳號安排面試及錄用，重新整理確認正式案件、需求額滿且不再顯示操作；兩側仲介重整也不再顯示該需求轉介／推薦。
6. `review.guide@example.invalid` 可看未申請指引（若先前已送審則應顯示待審）；送審後重新整理與重新確認都維持待審。既有 `review.new@example.invalid` 可直接看待審。送審不自動重設。
7. 用瀏覽器窄視窗檢視工作起點與配對頁，確認無水平溢出、按鈕不被遮住；不等同 iPhone 實機通過。

每個角色使用不同瀏覽器 profile 或先登出；多個普通分頁共用 cookie，不能當成獨立角色。

### Agent 自動驗證（WSL）

    node --test tests/hr-workflow.test.mjs
    docker compose --env-file .env.review.local -f compose.review.yaml build app
    docker compose --env-file .env.review.local -f compose.review.yaml up -d --no-deps --force-recreate app
    <playwright-python> scripts/verify-local-review.py
    git diff --check

`<playwright-python>` 為已安裝 Playwright 與 Chromium 的獨立 Python 環境。腳本會建立隔離虛構會員／工人／需求／案件，不是純讀取；不會重設既有資料。新電腦尚未建立隔離環境時，先由 Agent 核對並取得 secrets／初始化授權，不直接套用正式 DB。

GitHub CI 只驗證 build，不會自動跑上述本機瀏覽器流程。main 的既有 Deploy workflow 可能在合併後自動部署，驗收前不要合併。


更新日期：2026-11-05。B 三流程整理已在本機實作及驗證，網站入口不變。此頁是目前操作與環境變數入口；完整本輪證據見 `VERIFICATION_REPORT.md`，計畫主檔見 `ROADMAP.md`。下方 2026-11-04 啟動紀錄與「改版前觀察」保留作歷史，不代表目前仍未實作。

## 1. 現在可以怎麼看

Windows 只使用瀏覽器：

- 登入：<http://localhost:8088/hr/login>
- 人力工作區：<http://localhost:8088/hr>
- 品牌首頁：<http://localhost:8088/>

這是本機 Docker Desktop 的隔離測試站，不是線上正式網站，也沒有連真實 LINE／Google。

| 身分 | Email |
| --- | --- |
| 系統管理者 | `review.admin@example.invalid` |
| 台灣仲介業務 | `test.agency.tw@example.com` |
| 菲律賓仲介承辦 | `test.agency.ph@example.com` |
| 雇主 | `test.employer01@example.com` |
| 工人 | `test.worker01@example.com` |
| 新會員（尚未申請，可體驗角色選擇） | `review.guide@example.invalid` |
| 已送審會員（可看待審狀態） | `review.new@example.invalid` |

上述帳號使用同一組僅供隔離 Demo 的隨機密碼。在本機編輯器開啟 repo root 的 `.env.review.local`，查看 `REVIEW_LOGIN_PASSWORD`；不要把檔案或值貼到聊天／Git。其他四位雇主與四位工人的測試帳號也已建立。

這不是個別帳號的正式密碼政策。除了隔離虛構資料，不得使用這套配置儲存真實個資。

## 2. Git 合併證據

使用者核准方向為 origin/main → 本機 wei，不 push。

- 合併前 wei：`ed3c2ab575d79e7d142ec03516c9f0d9b561e47d`。
- 最新 fetch 的 origin/main：`e939b40ee27c21746b106f784502061fa939db8e`。
- `git rev-list --left-right --count wei...origin/main` 在合併前為 `0 7`。
- `git switch wei` 後執行 `git merge --ff-only origin/main`：成功、無衝突、沒有額外 merge commit。
- 本機 wei 現在等於 e939b40，較 origin/wei 領先 7 commits。
- 為本輪本機環境檔案另建 `feature/local-review-onboarding`，目前 HEAD 仍為 e939b40；工作檔尚未 commit。
- 未 checkout／修改 main、未 push、未合併到 main、未部署。舊的兩份 docs 完整保留。

main 帶來的新內容含 CI／部署 workflow、LINE 登入重試提示、姓名欄位元件與 admin_scope 等；這次只是整合其既有程式，不表示本機已驗收或核准正式權限政策。新增 workflow 沒有透過 push 觸發。

## 3. 隔離 Docker 配置

本輪新增 `compose.review.yaml`，不修改原 `docker-compose.yml` 的部署拓樸。

- Compose project：`tk-saas-local-review`。
- app container：`tk-saas-review-app`，只發布 `127.0.0.1:8088`。
- database container：`tk-saas-review-postgres`，不發布主機 PostgreSQL port。
- 獨立 database：`tk_saas_review`，獨立 volume：`tk_saas_review_postgres_data`。
- 不啟動 notebook、Nginx、Certbot 或 Cloudflare DDNS。
- 隨機 secrets 存在 `.env.review.local`；已確認被現有 Git 與 Docker 的 `.env.*` 規則排除。
- build image：`tk-saas-sales-demo-review:workflow-b`。

### 目前已設定，不用使用者再提供

| 本機欄位 | 映射至 app／DB | 用途 |
| --- | --- | --- |
| `REVIEW_DB_PASSWORD` | PostgreSQL password／DATABASE_URL | 隔離測試 DB 密碼 |
| `REVIEW_AUTH_SECRET` | NEXTAUTH_SECRET | 本機 session 簽章 |
| `REVIEW_DOCUMENT_KEY` | HR_DOCUMENT_ENCRYPTION_KEY | 32-byte Base64 文件金鑰 |
| `REVIEW_LOGIN_PASSWORD` | 虛構帳號登入密碼 | bootstrap 建立測試帳號 |

Compose 另明確設定 `APP_ORIGIN`、`NEXTAUTH_URL` 為 `http://localhost:8088`、`AUTH_TRUST_HOST=true`、管理者白名單為上述虛構管理者；禁止照搬到正式環境。

### 若要驗真實外部登入／LINE，才需要另行設定

- LINE Login：`LINE_LOGIN_CHANNEL_ID`、`LINE_LOGIN_CHANNEL_SECRET`，並核對 LINE Developers callback 與同 Provider 關係。
- Messaging API：`LINE_MESSAGING_CHANNEL_SECRET`、`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`，以及第三方可連到的 HTTPS Webhook。
- LINE 管理者登入視需求設定 `HR_ADMIN_LINE_USER_IDS`，這是權限變更，須另核准。
- Google：`OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET`、`OIDC_ISSUER`，並核對 OAuth callback。

本機測試 Compose 刻意沒有透傳這些 provider secrets；不能只把值放入 `.env.review.local` 就宣稱外部登入已接通。後續需明確新增環境映射與可達 callback，再測真人流程。請勿在聊天貼 secret、token 或真實個資。

B 版登入頁已隱藏未設定的 LINE／Google 按鈕並提供說明；本機使用 Email 密碼表單。這是 UI 呈現調整，不是新增認證方式。

## 4. 2026-11-04 啟動歷史與結果

所有專案操作由 WSL 執行；應用程式／資料庫由 Docker Desktop 容器執行。

【WSL】

    git fetch origin refs/heads/main:refs/remotes/origin/main refs/heads/wei:refs/remotes/origin/wei
    git switch wei
    git merge --ff-only origin/main
    git switch -c feature/local-review-onboarding
    docker compose --env-file .env.review.local -f compose.review.yaml config --quiet
    docker compose --env-file .env.review.local -f compose.review.yaml build app
    docker compose --env-file .env.review.local -f compose.review.yaml up -d --wait review-postgres
    docker compose --env-file .env.review.local -f compose.review.yaml run --rm --no-deps -v "${PWD}:/review:ro" app node /review/scripts/local-review-bootstrap.mjs
    docker compose --env-file .env.review.local -f compose.review.yaml up -d --wait app

結果：fetch／快轉成功；獨立 Compose 設定與 build 通過；PostgreSQL healthy，網站成功啟動。Next build 仍跳過 lint／型別檢查，不能報為通過。

初始化腳本使用本次 checkout 的 schema initializer 建立隔離資料表，再執行既有虛構 seed；隱藏 seed 印出的固定密碼並換成隨機測試密碼，補上管理者與新會員。這是經使用者明確授權的本機 schema／虛構資料操作，不是正式 migration。

腳本會拒絕非 `review-postgres/tk_saas_review` 目標，也會在已有會員時拒絕重灌／重設密碼；不要為了重跑而刪除 volume。

### 環境失敗與修復

首次拉 PostgreSQL image 失敗：WSL 無法執行 Docker Desktop 的 Windows credential helper（exec format error）。改用 profile scratch 下的獨立空 Docker config 匿名拉官方公開 image，成功；沒有修改原 Docker 設定、登入狀態或憑證。

首次 bootstrap 因 PostgreSQL 未啟動而 DNS 失敗；image 拉取成功後依序 `up --wait`、bootstrap、app，已通過。

### HTTP／瀏覽器

- `/`：200。
- `/hr/login`：200。
- 未登入 `/api/hr`：401。
- Playwright Chromium 實際用登入表單測管理者、台灣仲介、菲律賓仲介、雇主、工人、新會員：6 個 session 都能到 `/hr`，各自 `/api/hr` 為 200，捕獲 pageerror 共 0。
- 六種 API role 與預期相符；新會員是 pending，不代表其申請指引正確。
- 實際點開管理端仲介機構／媒合需求、兩側仲介資料頁、雇主需求頁，截圖並檢視。
- 台灣仲介基本資料分頁在 390 px viewport 的 document scrollWidth=390；此單頁沒有水平溢出，不代表所有手機頁面通過。
- 沒有測 iPhone／LINE WebView。

### 配對流程：真實隔離 PostgreSQL＋登入 session API

使用 Playwright 建立三個獨立登入 session，再透過其 request client 依角色呼叫 API；不是點完所有配對按鈕的純 UI E2E。

1. 雇主建立家庭幫傭需求、分派台灣仲介：POST 201，GET 讀回需求存在。
2. 台灣仲介轉交菲律賓仲介：POST 201，GET 讀回 route 存在。
3. 菲律賓仲介推薦虛構 worker 05：POST 201，雇主 GET 可見 candidate。
4. 雇主標記錄用：PATCH 200；GET 讀回正式 case=5、需求狀態 filled。

以上四個動作符合預期；推薦／錄用畫面亦重新載入檢查。本輪沒有測實際面試排程、通知送達、不同機構越權或重複錄用競爭。

初始化後會員 14、原案件 4；驗收新增 1 件案件、1 張需求單，目前為會員 14、案件 5、需求 1。重跑 bootstrap 的拒絕測試 exit 1（預期拒絕），前後讀回均為 `14|5|1`，未覆蓋既有虛構資料。

## 5. 改版前觀察與方案（歷史，B 已選定並實作）

### 仲介管理

- 管理端仲介機構表目前主要是名稱、台菲類型、國家、狀態與編輯／停用。
- 缺少「機構 → 管理員／業務／承辦 → 雇主／工人／需求／案件」的關係總覽，難定位誰負責下一步。
- 仲介登入先落在基本資料；配工藏在「仲介／雇主資料」而非明確的「待處理需求」。
- main 已新增 admin_scope，但本輪只測既有業務／承辦帳號與系統管理者，尚未驗 agency admin 的完整分流／權限。

### 工人／雇主配對

- API happy path 能建立正式案件，不需從零重寫。
- 需求已 filled，但台灣仲介仍顯示「待轉交的雇主需求」與轉交按鈕；菲律賓端仍顯示推薦表單，即使已錄用且沒有可用人選。
- 雇主畫面把建立需求、候選人、同仲介其他案件與履歷堆在同一頁，下一步不明顯。
- 「需求單分派的仲介」與「雇主所屬仲介」是兩個可分開的設定，畫面缺乏差異說明。

### 新會員指引

- 透過本機建立的 role=NULL、requested_role=NULL 帳號登入，API 回 pendingApproval=true；畫面顯示「申請已送出／申請類型：尚未選擇」，沒有選角表單。
- 這是可重現的狀態判斷問題。沒有以真實 LINE 新註冊證明每位使用者都會遇到，兩者不能混稱。
- 待審頁版面與正式工作區不同，主要內容貼近左上角；缺少申請進度、待辦、負責窗口與退回補件說明。
- 未設定的第三方登入按鈕仍可見，會讓本機測試者誤以為已接通。

### 當時提出的方案（使用者已選 B，現行完成狀態見驗證報告）

A. 最小修補：修正新會員未申請／已送審狀態、已額滿需求停止待辦顯示、加上下一步提示。變動小，但仲介管理資訊架構仍分散。

B. 三條流程一起整理（建議）：仲介機構詳情與人員責任、需求→轉介→推薦→面試→錄用的狀態導覽、新會員角色化起步指引。沿用現有 API／schema 為優先，任何必要的認證、權限或 schema 變更另核准。範圍較 A 大，但能改善真正的操作閉環。

C. 連同正式多機構權限／審查政策重整：最完整，但牽涉資料遷移、職務分權與較大回歸成本，先確認政策後再動手。

值得延伸：每個角色登入看到「今天由我處理的事項」、需求停滯天數與負責人，點進去直接完成下一步；通知先用站內提醒，不直接假設可發真實 LINE。

B 已依確認方向完成仲介目錄、需求獨立分頁與五階段指引、新會員選角／待審狀態及可用登入方式提示；詳見 VERIFICATION_REPORT.md。前輪發現的 worker 審核越權、私鑰追蹤、依賴弱點仍需獨立安全工作，不能因本機 happy path 通過就放行。

## 6. 截圖

均為本機虛構人物，沒有密碼、token 或真實個資。

- [管理端仲介機構](review/admin-agencies.png)
- [台灣仲介與已錄用需求](review/taiwan-matching.png)
- [雇主推薦人選／錄用操作前](review/employer-matching.png)
- [新會員狀態與指引問題](review/new-member.png)

## 7. 後續開關與未驗項目

服務目前留在 Docker Desktop 執行。既有 volume 保留，不會因 app 停止消失。

【WSL】

    docker compose --env-file .env.review.local -f compose.review.yaml ps
    docker compose --env-file .env.review.local -f compose.review.yaml stop
    docker compose --env-file .env.review.local -f compose.review.yaml up -d --wait

以上 stop／再次 up 是提供後續操作方式；B 版已重新建立 app 並確認既有資料保留，但沒有做資料庫重啟／備份還原演練。不要使用 down -v。若修改 secrets，必須另外確認與重建／重啟，不要直接覆蓋原金鑰。

尚未驗證：Windows 端實際瀏覽器連線（已從 WSL 主機與 Chromium 連到 published port）、真實 LINE／Google、iPhone、正式金鑰備份、文件上下載閉環、完整權限矩陣、CI／Production、lint／型別檢查。未對外開站、push 或部署。
