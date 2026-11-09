# TASK_LOG｜TK SaaS 本機接手紀錄

## 2026-11-10 PR 候選重新驗證

- 使用者已授權提交、push 與建立 PR；來源 `feature/local-review-onboarding`，目標 `main`。下方「未 commit／push」為前輪歷史，實際發佈與 CI 狀態以 GitHub PR 為準；本輪不合併、不部署。
- 已 fetch 並確認 `origin/main` 沒有超前目前基底的 commit。
- 本輪實跑 `node --test tests/hr-workflow.test.mjs`：19 通過、0 失敗、0 跳過；Docker Compose build 成功（lint／型別仍依既有設定跳過）。
- 重建僅 app 並讀回 image 一致後，重新執行 `scripts/verify-local-review.py`：20 通過、0 失敗、pageerror=0；配對五步皆由 UI 操作、逐步 API 讀回。前置工人／待審會員仍為 fixture。
- 只新增隔離虛構測試資料，不重設 DB／volume；先前資料計數及 image ID 是歷史快照，不代表目前累計。
- 驗收使用 localhost:8088，不連真實 LINE／Google。完整跨機構拒絕、真實文件、通知、iPhone、備份還原與既有安全缺口未因此放行。
- 注意：既有 Deploy workflow 在 push main 時可能觸發 self-hosted 部署；本 PR 不應在本機驗收前合併，也未修改該 workflow。


## 2026-11-05 B 三流程整理（本機已驗證，未發佈）

- 使用者選定 B，依 `ROADMAP.md` 沿用現有資料模型與權限，完成仲介關係目錄、角色工作起點、獨立配對分頁與五階段導覽、新會員未申請／已送審指引。
- 新增 `src/lib/hr-workflow.js`、`src/components/HrJourney.jsx`／CSS 與 `HrAgencyDirectory.jsx`；修改既有 HR 管理／會員頁、登入頁與翻譯。API 僅修正 pendingApproval 旗標，不新增核准／權限或 schema。
- 需求額滿／取消保留唯讀紀錄，不再顯示轉交、推薦或面試／錄用操作；後端完整狀態機與安全問題不在本輪。
- 實際 `node --test tests/hr-workflow.test.mjs`：19 通過、0 失敗、0 跳過。
- 最終 Docker build 通過，image `tk-saas-sales-demo-review:workflow-b`；僅重建 app，保留原資料庫與 volume，網站仍為 <http://localhost:8088/hr/login>。
- `scripts/verify-local-review.py` 最終 20 通過、0 失敗。六角色登入與角色確認；仲介搜尋／篩選／詳情；390px；由 UI 完成建立需求→轉介→推薦→面試→錄用，逐步 API 讀回；新會員 UI 選角送審與重新整理；pageerror=0。
- 瀏覽器測試中途三次因語言載入／accessible name／select 巢狀 label 定位失敗，修正測試定位後通過；最後產品小幅補完後重新 build 並完整重跑。沒有略過產品斷言。
- 虛構工人與 pending 會員是隔離 fixture，不把 fixture 建立宣稱成真實註冊 UI。最終讀回累計會員 16、工人 7、案件 8、需求 3；不將所有既有資料都當成本輪建立。
- 另保留 `review.guide@example.invalid` 為未申請的新會員體驗帳號；原 review.new 已送審。密碼維持從本機忽略環境檔讀取，不貼聊天。
- 同步 README、LOCAL_REVIEW、ROADMAP、VERIFICATION_REPORT、PROJECT_MAP；新截圖 b- 前綴，保留前輪歷史圖。
- 未 commit／push／merge main／部署。未改 secrets、認證政策、管理權限、schema 或正式資料；只使用前輪已授權的隔離虛構 DB。
- 未驗：真人 LINE／Google、iPhone／LINE WebView、Filipino、agency admin 全流程、完整跨機構拒絕、上下載、通知、並行競爭與備份還原。lint／型別仍被 build 設定跳過。前輪 worker 審核越權、ACME 私鑰與依賴風險仍待獨立處理。

## 2026-11-04 合併 main、建立隔離測試站與操作檢查

- 已依使用者確認，fetch 最新 main／wei，將 origin/main 快轉合併進本機 wei：ed3c2ab → e939b40；無衝突、沒有額外 merge commit。main 未修改、未 push。
- 本輪本機配置在 `feature/local-review-onboarding`，與本機 wei 同 HEAD；所有新文件／配置尚未 commit。前輪地圖與比較報告保留。
- 使用者另核准產生本機隨機 secrets、獨立 PostgreSQL schema 與虛構測試帳號。新增 `compose.review.yaml`、`scripts/local-review-bootstrap.mjs`，以 `.env.review.local`（Git／Docker 排除）保存 secrets。
- Docker Desktop 容器 `tk-saas-review-app`／`tk-saas-review-postgres` 已啟動，網站 <http://localhost:8088/hr/login>。不啟動 DDNS、notebook、Nginx，不連真實 LINE／Google。
- 實際 build 通過；公開 HTTP 200／200，匿名 HR API 401；6 個角色經 Chromium 登入，HR API 皆 200，捕獲 pageerror=0。
- 已用真實隔離 PostgreSQL 與各角色登入 session API 驗證建立需求、轉介、推薦、錄用；三次 POST 201、一次 PATCH 200，逐步讀回，最終建立 case 5、需求 filled。不是全按鈕 UI E2E。
- 測試資料目前會員 14、案件 5、需求單 1。bootstrap 防重跑測試按預期拒絕（exit 1），前後計數均 `14|5|1`。
- 實際畫面發現：新會員尚未選類型卻顯示已申請且無選角入口；filled 需求仍出現在仲介待轉交／推薦區；登入頁仍顯示未設定 provider 按鈕。尚未修改產品、認證或權限程式。
- 使用者指定優化主題：仲介管理頁面、工人／雇主配對、新會員指引。已在 `LOCAL_REVIEW.md` 提出 A／B／C 方案與取捨；待選定方向，不另先建立執行計畫。
- 本輪問題與修復：WSL Docker credential helper 無法執行，以暫存空 config 匿名拉取公開 PostgreSQL image，未改原登入／憑證設定；首次 bootstrap 在 DB 尚未起來時失敗，改先 up --wait 後通過。
- 新有效入口為 `LOCAL_REVIEW.md`，截圖放 `docs/review/`，PROJECT_MAP 同輪更新。前輪比較報告標為 ed3c2ab 時點歷史。
- 未做：push／merge main／部署、真實資料、LINE／Google 真人、iPhone、完整跨機構權限、安全缺口修正、文件上下載閉環、lint／型別檢查、Windows 瀏覽器與重啟持久化驗收。
