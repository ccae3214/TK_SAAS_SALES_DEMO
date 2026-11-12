# TASK_LOG｜TK SaaS 本機接手紀錄

## 2026-11-12：權限盤點與可重跑流程測試討論

- 使用者選通知 A 輕量可靠版、確認會員送審觸發，收件人先釐清現有系統管理權限；仍在討論、不執行 schema／產品／LINE 變更。
- 再 fetch main，仍為 809259b。讀 hr-access、HR API、訓練中心、互貿認證角色關卡，補 NOTIFICATION_DISCOVERY.md 現況矩陣；分清環境 LINE 最高管理者、全站 admin、所屬仲介管理者與一般業務角色。
- 現況注意：環境白名單優先於 DB active；訓練中心自有課程按 center_id 隔離，但候訓工人名單目前全域符合條件，不能宣稱已按中心分派隔離。未查正式帳號名單或改權限。
- 本機來源映射＋DB替身探針11通過／0失敗，沒有真實DB／API權限測試。查證Playwright官方Test Agents、CLI skill、API testing、Trace Viewer與axe整合文件；一個舊文件URL404後改正確官方URL取得內容，未安裝或執行第三方套件。
- 使用者要的是跨角色業務流程自動回歸，不是單純看UI；建議固定E2E＋AI探索協助，預期與測試閘門不可由healer自行放寬。策略尚未選定，未寫新產品計畫或宣稱新版E2E通過。

## 2026-11-12：最新 main／通知與 UI 測試需求查核

- 明確 fetch main 至 809259b；#18 已合併（31a9dd1）。從該 main 建 review/admin-notifications，只改查核與文件狀態，未實作產品；舊 linked-record store 比對仍一致。
- 2940321 刪 scripts、f3dcae2 刪 tests；實際工作樹也沒有 .scripts／.tests 替代目錄。node --test tests/hr-linked-record-store.test.mjs 回 exit=1、Could not find；屬驗證入口失效，不是產品斷言失敗。CI 只有網站 build 與記帳 pytest，無 HR 回歸。
- 閱讀 README、ROADMAP、LOCAL_REVIEW、PROJECT_MAP、VERIFICATION_REPORT、AGENCY_CERTIFICATION 與 accounting-bot README；前述多處仍引用不存在的腳本，已加現況警示，歷史測試不外推。
- 程式確認 HrReminders 每30秒抓HR／chat，沒有待審會員類型；任一API失敗清空提醒。主會員清單靠載入／手動／focus 更新，10秒只是節流非輪詢。member-request 送審沒有通知管理者的呼叫；現有 LINE push 是核准後通知申請人，記帳 Bot 是另一帳號不可混用。
- NOTIFICATION_DISCOVERY.md 記錄精確快照、來源位置與界線；未量測正式站延遲、未跑新版UI、未接觸新增DB initializer，現有容器維持原版運作。
- 使用者正在探討通知與UI／UX測試委託；方案、觸發點、收件人及執行範圍未確認，不先寫產品計畫／程式。未push、開PR、部署、改DB或發LINE。

## 2026-11-11：main 基底修正／防退版查核（歷史）

- #17 已合併，方向 main → wei，head 2d56a90、squash cded102，兩者 tree 相同（diff exit=0）；109 檔是相對舊 wei 累積差異，未發現該同步使 main 退版。最初假設 mergeCommit^2 查詢失敗，查明是 squash 後以精確 tree 比對修正判讀，不臆測人員動機。
- 新 main=3772bcf（含 4f66df6 自動更新、CSP／nonce），從 origin/main 建 fix/hr-linked-record-consistency；使用者指定之後 PR 目標 main，不在 main 直接寫程式、不再為此同步 wei。
- 使用者本次明確批准僅隔離 tk_saas_review：先備份／實際還原，再套用 main 既有 trigger；另批准一般工人／雇主不可改用保留管理者 Email，不變更既有合法管理者登入。7 組備份／還原計數一致，保留 dump 與驗證 DB；不進 Git。
- 本次用共同 client／transaction 修正 5 個正向分支及反向 member-profile，保留原角色／機構範圍、LINE-only 與無會員空聯絡資料；移除舊分段 sync helper，補英文錯誤文字。沒有新增 DDL／migration、修改 secrets、部署或碰正式資料。
- 最終 Node 85／既有 Chromium 26／撤回 15／新整合 20 全通過；真實 PostgreSQL 正反向故障注入皆回滾，兩個並行 HTTP 對同 Email 得 200/409 且無部分寫入；CSP、focus 更新／編輯器跳過更新亦驗。build 成功，image 讀回一致，本機 app 運作中。
- 中途 fixture Email 同名、漏填既有必填姓氏、重整後錯分頁定位造成失敗，補足測試輸入與真實 PATCH 斷言後完整重跑，未刪斷言。自我審查將 callback 內原驗證移到交易前，補非法 name/type HTTP 無寫入及回傳 id 防護。
- 合作人入口 LINKED_RECORD_REVIEW.md（自我審查，不是獨立核准）；摘要 review/linked-record-results.json。既有 E2E 自動改寫的大圖另存測試證據後還原，避免混入 PR。精確 PR head／CI 由 PR 讀回，不借用舊 checks。
- 未驗：真實 LINE／Google、iPhone／WebView、正式資料、真實附件、破壞性刪除、完整安全／壓力矩陣、真實 outage。lint／型別原設定跳過；文件適用性／案件階段 resync 保留既有 commit 後 follow-up。

## 前輪更新：推薦撤回與合作人審查（歷史）

- 已依使用者確認，新增所屬菲律賓仲介在安排面試前撤回推薦；保留工人、履歷、文件與推薦歷史，阻擋跨機構、雇主來源、已面試／錄用、結束需求及過時寫入。
- 本輪凍結整合基底 main `e0e5a71`，仍在 feature/local-review-onboarding／PR #12；不合併 main、不部署、不新增 schema。本次操作權限範圍已另外確認，不擴充其他角色代撤回權限。
- 實測：Node 55 通過、0 失敗、0 跳過；既有 Chromium 回歸 26 通過；推薦撤回專項 15 通過，兩組瀏覽器 pageerror=0；最終 Docker build 成功並重建 app。錯誤角色、跨機構、重試、資料保留及真實 PostgreSQL 並行互斥均已驗。
- 舊 image 先重現缺按鈕；新專項中途因測試 UI 未填說明卻預期有說明而失敗，補上實際輸入後完整重跑，未刪除斷言。
- 使用既有 rejected＋append-only notes 事件表示撤回，含伺服器時間與 member ID；不是新的獨立防竄改稽核。已撤回同一 route 不提供重新啟用，改推其他人選；細節及 NULL 歷史來源假設見 REVIEW_REPORT。
- 合作人入口：[REVIEW_REPORT.md](REVIEW_REPORT.md)。這是實作者自我審查＋執行證據，不是獨立 reviewer 核准。GitHub CI／head 以 PR 讀回為準，不預填成功。
- 未驗：真實 LINE／Google／通知、iPhone／WebView、完整多機構矩陣、真實附件、正式資料與完整壓力／重試矩陣；lint／型別仍被原 build 設定跳過。

## 前輪整合與驗證紀錄（歷史）

## 最新狀態：整合 main 756b2b8 的本機候選

PR：https://github.com/ccae3214/TK_SAAS_SALES_DEMO/pull/12 。已在 feature 分支解決五個內容衝突並整合 main `6caf5df`，再納入測試期間新增的 main `aaab5fa`（操作稽核與會員類型保護），未合併到 main、未部署；GitHub head／CI／Draft 狀態以 PR 讀回為準。下方較早的「有衝突／等待遷移授權／沒有 workflows／19 或 20 項測試」都是歷史紀錄。

- 使用者明確批准先備份再遷移，只操作 Docker `tk-saas-local-review` 的 `tk_saas_review`。
- 停止 app 後 `pg_dump -Fc` 備份到 Agent profile 的獨立 backups 目錄（不進 Git）；實際 `createdb`／`pg_restore --exit-on-error` 至獨立驗證 DB，6 組關鍵計數一致：會員 18、工人 10、案件 10、需求 7、必要文件 220、送件 0。保留原 dump 與還原驗證 DB，不刪 volume。
- 啟動新版後讀回：舊 `hr_case_requirements` 已遷移為 `hr_worker_documents`、存在 `hr_case_certifications`；上述會員／工人／案件／需求計數不變，文件仍 220、送件仍 0。此資料集沒有已上傳文件，不能推論真實附件歷史遷移通過。
- 保留 main：工作摘要、會員所屬仲介與訓練中心選項、送審成功提示、工作者層級文件、履歷與審核元件。相對 main 的 HR API 差異僅 pendingApproval 旗標；不重寫其 schema、權限或認證政策。
- main 已改為雇主直接選工，或管理者指派菲律賓機構後由該機構推薦；不恢復已移除的台灣仲介手動轉交 API。B 導覽改為需求建立→仲介分工→挑選／推薦→面試→錄用。
- `node --test tests/hr-workflow.test.mjs scripts/test-hr-requirements.mjs`：35 通過、0 失敗、0 跳過（B 23＋main 文件規則 12）。
- Docker build 成功；僅重建 app 後，`<playwright-python> scripts/verify-local-review.py`：26 通過、0 失敗、pageerror=0。兩條配對路徑皆 UI 操作及 API 讀回；工人與待審帳號為 fixture，不冒稱真實註冊。
- 額滿需求在雇主、菲律賓仲介與管理者桌面／手機配對控制停止操作；台灣仲介保留新版追蹤頁。Node 仍涵蓋取消與過時 open 額滿投影。
- 新會員沿用 main 的完整類型＋所屬仲介表單，加入重讀狀態；不採用舊版只有角色選擇的表單。舊自動測試的手動轉交改測管理者指派，是配合 main 已變更的流程，並額外驗證雇主直接選工，不減少配對閉環斷言。
- 測試中途曾因管理端桌面不是 article、新會員 select 巢狀 label、必要文件需展開 B 階段而失敗；修正定位／展開後完整重跑通過。`git diff --check` 曾發現空白，已修正並重跑。
- `node --check scripts/local-review-bootstrap.mjs`／Python compile 通過；bootstrap 對既有 DB 以預期非零拒絕，不重設帳號。配合新版 initializer 更新抽取與 migration 相依注入；本輪未重跑全新空 DB 的初始化，不能宣稱冷啟動已驗收。
- 最後完整瀏覽器測試後隔離資料累計：會員 25、工人 22、案件 21、需求 20、文件 484、送件 0；含歷史及中途測試紀錄，不把它們都算成單次成功測試建立。
- 留給使用者：工人 `DEMO-手動推薦測試工人-A`（ID 10）、需求 `DEMO-手動推薦驗收`（ID 16，open 且已指派菲律賓機構）；畫面已選得到且推薦按鈕啟用，未提交推薦、未錄用。
- main 已恢復 CI／Deploy workflows；CI 僅 build，合併 main 可能觸發部署，未獲授權不合併。lint／型別仍依既有設定跳過，Browserslist 過時警告未處理。
- 未驗：真實 LINE／Google／通知、iPhone／WebView、完整跨機構拒絕、agency admin 全流程、真實文件上下載、並行錄用、全新環境初始化與正式備份還原。僅本機小型資料集的備份還原與遷移已測；不是正式放行。

- 額外逐筆查核原有會員／工人／案件／需求的識別與關係仍在。初次以文件 ID 必須完全不變查核失敗，原因是 main migration 原本就會合併重複文件；進一步確認原 220 列含 22 列重複、共 198 組工作者／文件／狀態，全部仍存在，無遺漏。文件 ID 不保證保留，不能用總列數相同取代此語意查核。
- main `aaab5fa` 的稽核 endpoint 已驗 admin 200、worker 403、匿名 401，並確認 hr_admin_audit_log 已建立；未驗稽核寫入的所有 action。最新 main 的 schema／權限／稽核程式原樣保留。
- 完整 staged diff 檢查曾指出 upstream 補丁檔自帶的尾端空白（先前 admin-search-bars.patch，後來 admin-audit-log.patch）；未擅改補丁內容。最終相對 aaab5fa 的 PR diff、工作區 diff 檢查通過；這不是縮減產品測試。

- 後續重新開啟同一 Draft PR 以刷新計算時，讀回 base 已是 `756b2b8`，因此前述 PR dirty 不能直接斷言為 GitHub 平台錯誤；先前 base 資訊已過時。已再整合此 main 更新、保留新增的管理端刪除功能與稽核（未執行任何刪除），解決 1 個管理頁衝突後，重建並完整重跑 Node 35／Chromium 26 全通過。
- 最終驗證基底固定為 `756b2b8`，其後若團隊再更新 main，須另外判斷差異，不把這份結果自動外推至未測版本。最後 image `sha256:a150c8200bac63ee56c761c04f3c2cd5fe3e1667723183d0333fe6244c91618a`。

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
