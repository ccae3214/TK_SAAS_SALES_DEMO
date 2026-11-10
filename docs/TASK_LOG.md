# TASK_LOG｜TK SaaS 本機接手紀錄

## 最新狀態：整合 main 6caf5df 的本機候選

PR：https://github.com/ccae3214/TK_SAAS_SALES_DEMO/pull/12 。已在 feature 分支解決五個內容衝突並整合 main `6caf5df`，未合併到 main、未部署；GitHub head／CI／Draft 狀態以 PR 讀回為準。下方較早的「有衝突／等待遷移授權／沒有 workflows／19 或 20 項測試」都是歷史紀錄。

- 使用者明確批准先備份再遷移，只操作 Docker `tk-saas-local-review` 的 `tk_saas_review`。
- 停止 app 後 `pg_dump -Fc` 備份到 Agent profile 的獨立 backups 目錄（不進 Git）；實際 `createdb`／`pg_restore --exit-on-error` 至獨立驗證 DB，6 組關鍵計數一致：會員 18、工人 10、案件 10、需求 7、必要文件 220、送件 0。保留原 dump 與還原驗證 DB，不刪 volume。
- 啟動新版後讀回：舊 `hr_case_requirements` 已遷移為 `hr_worker_documents`、存在 `hr_case_certifications`；上述會員／工人／案件／需求計數不變，文件仍 220、送件仍 0。此資料集沒有已上傳文件，不能推論真實附件歷史遷移通過。
- 保留 main：工作摘要、會員所屬仲介與訓練中心選項、送審成功提示、工作者層級文件、履歷與審核元件。相對 main 的 HR API 差異僅 pendingApproval 旗標；不重寫其 schema、權限或認證政策。
- main 已改為雇主直接選工，或管理者指派菲律賓機構後由該機構推薦；不恢復已移除的台灣仲介手動轉交 API。B 導覽改為需求建立→仲介分工→挑選／推薦→面試→錄用。
- `node --test tests/hr-workflow.test.mjs scripts/test-hr-requirements.mjs`：35 通過、0 失敗、0 跳過（B 23＋main 文件規則 12）。
- Docker build 成功；僅重建 app 後，`<playwright-python> scripts/verify-local-review.py`：25 通過、0 失敗、pageerror=0。兩條配對路徑皆 UI 操作及 API 讀回；工人與待審帳號為 fixture，不冒稱真實註冊。
- 額滿需求在雇主、菲律賓仲介與管理者桌面／手機配對控制停止操作；台灣仲介保留新版追蹤頁。Node 仍涵蓋取消與過時 open 額滿投影。
- 新會員沿用 main 的完整類型＋所屬仲介表單，加入重讀狀態；不採用舊版只有角色選擇的表單。舊自動測試的手動轉交改測管理者指派，是配合 main 已變更的流程，並額外驗證雇主直接選工，不減少配對閉環斷言。
- 測試中途曾因管理端桌面不是 article、新會員 select 巢狀 label、必要文件需展開 B 階段而失敗；修正定位／展開後完整重跑通過。`git diff --check` 曾發現空白，已修正並重跑。
- `node --check scripts/local-review-bootstrap.mjs`／Python compile 通過；bootstrap 對既有 DB 以預期非零拒絕，不重設帳號。配合新版 initializer 更新抽取與 migration 相依注入；本輪未重跑全新空 DB 的初始化，不能宣稱冷啟動已驗收。
- 最後完整瀏覽器測試後隔離資料累計：會員 23、工人 18、案件 17、需求 16、文件 396、送件 0；含歷史及中途測試紀錄，不把它們都算成單次成功測試建立。
- 留給使用者：工人 `DEMO-手動推薦測試工人-A`（ID 10）、需求 `DEMO-手動推薦驗收`（ID 16，open 且已指派菲律賓機構）；畫面已選得到且推薦按鈕啟用，未提交推薦、未錄用。
- main 已恢復 CI／Deploy workflows；CI 僅 build，合併 main 可能觸發部署，未獲授權不合併。lint／型別仍依既有設定跳過，Browserslist 過時警告未處理。
- 未驗：真實 LINE／Google／通知、iPhone／WebView、完整跨機構拒絕、agency admin 全流程、真實文件上下載、並行錄用、全新環境初始化與正式備份還原。僅本機小型資料集的備份還原與遷移已測；不是正式放行。

## 以下為歷史紀錄

## 手動推薦 fixture 與最新 main 整合前檢查

- 使用者已同意補可推薦工人並整合 main 到 PR 分支；明確 fetch 後，最新 main 為 `6caf5df`。
- 在既有隔離 review app 以菲律賓仲介 session 呼叫既有 API，新增 `DEMO-手動推薦測試工人-A`（worker ID 10）；API 讀回確認 active、尚無案件，Chromium 重整後 1 個推薦下拉可見該工人。未實際推薦／錄用，保留給手動驗收。
- 第一次畫面檢查因 API 新增後頁面未重整而失敗；腳本補重整後重跑通過，沒有重複新增 fixture。
- 整合前發現 main 帶有新的自動 schema 遷移：文件由案件轉到工人、建立案件證照、合併文件與新增會員欄位。尚未執行 merge、重建新版 app 或讓遷移接觸 review DB；須先取得本次隔離 DB migration 的明確批准，建議先備份並驗證備份再執行。
- main 的 `6caf5df` 已恢復 CI／Deploy workflows；前輪「main 沒有 workflows」僅適用當時快照。未合併到 main、未部署、未 push。


## 2026-11-10 PR 候選重新驗證

- 使用者已授權提交、push 與建立 PR；來源 `feature/local-review-onboarding`，目標 `main`。下方「未 commit／push」為前輪歷史，實際發佈與 CI 狀態以 GitHub PR 為準；本輪不合併、不部署。
- 更正同步判斷：一般 `git fetch origin` 受本機 refspec 限制，沒有更新 main；改用 `git fetch origin refs/heads/main:refs/remotes/origin/main` 後確認最新 main 為 `f26ea46`，已包含近期文件模型與頁面重構。PR 有 5 個內容衝突（API、登入頁、HrManagement、HrMemberPortal、翻譯），保留 Draft，不自動覆蓋團隊更新。以下 local test 只驗證 e939b40 基底的 B 候選，不代表最新 main 整合通過。main 已移除 `.github` 目錄，因此本 PR 目前沒有 CI checks；前述部署 workflow 是舊基底狀態，非最新 main 現況。
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
