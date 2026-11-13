# VERIFICATION_REPORT｜目前本機候選與歷史實證

## PR #22：遵循 main 的衝突整合與驗證（目前候選）

- 本輪依使用者「遵循 main」確認，整合 main `52b0d7cfda4aaf378c8232c4fcec62d34f49d789`，僅更新 feature／同一 Draft PR；不合併 main、不部署。
- 衝突解法：`.gitignore` 保留測試與私密產物排除；`HrManagement.jsx` 保留 main 新手導覽／導航標記與通知功能，語言入口仍在側欄避免遮擋；`hr-translations.jsx` 同時保留 inline 模式與 `data-tour`。首頁 `/`、展示 `/demo`、新版履歷選項與上游其他行為照 main，不還原舊版。
- 先停止 app、`pg_dump -Fc`，實際 `createdb`／`pg_restore --exit-on-error` 至獨立驗證 DB。7 組備份／還原計數相符：會員 250、工人 97、雇主 10、仲介 12、案件 34、需求 45、文件 2134。dump SHA-256：`6b797099570c41ea9925c78501a8c5c01088c6f8bfcc952783f8e2c049c5d28c`；dump／還原 DB 均保留、不進 Git。
- 經本次授權啟動 main 初始化後，與備份的 public 全欄位 catalog 比對僅新增 `hr_members.onboarding_seen`（jsonb、NOT NULL、default `{}`），無移除／改變欄位；教育程度既有資料轉換 SQL 未執行。沒有調整認證、權限或 secrets。
- Docker build 成功；重建僅 app，running image 與候選 tag 均為 `sha256:f430c77ec85644f48aaf2c6dca13dbffd408c9594eec1f7a72ed6ede192c82e4`。build 仍跳過 lint／型別，Browserslist 警告未修。
- 實跑：Docker Node 20 `npm run test:hr` 110 通過；真實隔離 PostgreSQL＋受控傳輸 `node --test scripts/test-notification-store.mjs` 13 通過；完整 `npm run test:e2e` 桌機／390px Chromium 16 通過。三組最終均 0 失敗／0 跳過；Playwright `.last-run.json` 為 passed、failedTests 空。
- 保留失敗紀錄：初次單一 E2E 1 失敗（登入舊預期 `/hr`，main 已改 `/`）；調整後完整 14 通過／2 失敗（錯將菲律賓仲介導覽當成中文 admin 導覽）。依實際角色與 main 中英導覽調整 fixture helper，正常 UI 點略過並驗證 POST／伺服器 seen 紀錄，再完整 16 通過。原通知／取消／核准／拒絕／去重／編輯保護斷言皆保留，沒有停用導覽或改驗收門檻。
- HTTP：匿名 `/` 307（前往登入）、`/demo` 200、匿名通知 401。`git diff --check` 工作區及相對最新 main 的本次修改通過；合併前 `git diff --cached --check` exit 2，僅列上游 `src/app/demo/page.jsx` 搬移的既有尾端空白，保留原檔、不冒稱全 staged diff 通過。
- 精確合併 commit／push／GitHub 可合併性與 CI 以 PR #22 發佈後讀回為準。真實 LINE／Google、iPhone／WebView、正式 migration 與完整新手導覽／其他業務矩陣未驗；audit 既有 15 項警告未重新稽核或修復。以下較早未整合／等待授權／未發佈狀態均為歷史。

## PR #22 衝突整合中（尚未提交／推送）

- 已 fetch main `52b0d7c`，於 feature 分支執行 `git merge --no-commit --no-ff origin/main`；三個衝突已在本機解決並 stage：`.gitignore` 保留測試／私密產物排除；`HrManagement.jsx` 保留新版新手導覽及通知修復的側欄語言入口；`hr-translations.jsx` 合併 inline 模式與 `data-tour`。
- `git diff --name-only --diff-filter=U` 已無未解衝突；Docker Node 20 `npm run test:hr` 實跑 110 通過／0 失敗／0 跳過。
- `git diff --check` 工作區通過；`git diff --cached --check` exit 2，指出上游 `src/app/demo/page.jsx` 搬移內容既有尾端空白，未擅自修改上游頁面來掩蓋結果。
- 啟動前比對 initializer：main 新增 `hr_members.onboarding_seen JSONB NOT NULL DEFAULT '{}'::jsonb`；隔離 DB catalog 唯讀確認目前無此欄位。新 app 尚未建置／啟動，避免自動 schema 異動。等待使用者批准先備份／驗證還原，再只對 `tk_saas_review` 套用此 main 既有新增欄位。
- 尚未重跑整合後 DB／E2E／CI、未提交 merge、未 push 更新 PR；原已驗證 app 仍運作，非整合後新版。正式環境、權限與 secrets 未變；教育程度資料轉換腳本未執行。

## PR 發佈候選與上游差異

- 使用者已授權提交本輪驗證紀錄、push `feature/hr-member-request-notifications` 並建立以 `main` 為目標的 PR；不授權 main 合併或部署。
- 發佈前明確 fetch `refs/heads/main:refs/remotes/origin/main`，最新上游為 `52b0d7c`，已超過受測整合基底 `7093129`。包含首頁搬移、新手導覽、履歷欄位與翻譯等更新；本輪不在發佈流程混入整合或程式修改。
- 以 Draft PR 交付受測候選與可重跑流程；與最新 main 的整合、合併可行性及精確 head CI 須由 GitHub PR 實際狀態確認。下方「未 push／PR」描述的是各輪驗證當時狀態，不是發佈後的即時狀態。

## 重開機後接續驗證（候選 1f3d22c）

- 本輪確認工作分支 `feature/hr-member-request-notifications`、起始工作區乾淨；未修改產品程式，也未 fetch／整合新的 main。
- app／PostgreSQL 原為 exited，使用既有 Compose `start --wait review-postgres app` 恢復，沒有重建 image、重設 volume、變更 secrets 或新增 schema。原 app image 與候選 image 一致，啟動後讀回兩個服務運作中、DB healthy。
- 實際重跑：Docker Node 20 `npm run test:hr` 為 110 通過；`node --test scripts/test-notification-store.mjs` 真實隔離 PostgreSQL＋受控傳輸 13 通過；`npm run test:e2e` 桌機／手機 Chromium 16 通過。三組均 0 失敗、0 跳過；E2E 約 58.7 秒。只建立／處理虛構測試資料，不發真實 LINE。
- HTTP 讀回 `/hr/login` 200、匿名 `/api/hr/notifications` 401；`git diff --check` 通過。原始 Playwright 產物只留本機忽略目錄，既有版控截圖／機器摘要未被重寫。
- 未重新 build、audit、驗證遠端 CI／真實 LINE／iPhone／WebView；歷史依賴警告與 lint／型別跳過限制不變。未 push、開 PR、合併或部署；人工入口仍為 `http://localhost:8088/hr/login`。

## 2026-11-13：會員送審通知候選（最新）

基底已整合 main 7093129，feature/hr-member-request-notifications。正式審查：[MEMBER_NOTIFICATION_REVIEW.md](MEMBER_NOTIFICATION_REVIEW.md)；機器摘要：[member-notification-results.json](review/member-notification-results.json)。

- Docker Node 20 單元：110 通過／0 失敗／0 跳過（原 85 保留＋新 25）。
- 真實 PostgreSQL、受控傳輸：13 通過／0 失敗／0 跳過，非真實 LINE round trip。
- Playwright Test：桌機／390px Chromium 共 16 通過／0 失敗／0 跳過／0 flaky；每例 pageerror=0；前景提醒實測 4325ms／4666ms。
- Docker build 通過、running image 與候選一致；login 200／匿名通知 401。具體指令見審查報告；原始 HTML／trace 僅留本機忽略目錄。
- 已批准隔離 DB：先 dump／實還原比對 7 組計數，再加通知表並套 main 既有 schema；catalog 比對新增 4 表（含本輪通知表），沒有移除 table。
- 初輪 9 通過／7 失敗不隱藏；定位／fixture 與手機面板修正、語言工具遮擋修正後完整重跑至上述最終結果。沒有 skip 或改預期讓結果變綠。
- npm audit --omit=dev exit=1：15 項（3 moderate／8 high／4 critical），未修復；lint／型別仍跳過、不算通過。
- 未驗真實 LINE／Google、實體手機／iPhone／WebView、母語校對、完整媒合／文件／訓練與跨租戶安全矩陣；遠端 CI 未跑。下方 85／26／15／20 只屬歷史，不得外推。
- 未 push／PR／main merge／部署；正式環境未變。本輪人工入口與保留的虛構帳號看 LOCAL_REVIEW。


## 2026-11-12：809259b 現況查核（不是新版驗收）

- #18 已合併，但下方 85／26／15／20 為前輪受測結果。main 新增訓練中心／互貿認證等，不能沿用通過宣稱。
- 實跑 node --test tests/hr-linked-record-store.test.mjs：exit=1，檔案不存在；測試入口失效，沒有可計數的產品測試通過／失敗案例。scripts 與 tests 均不在此快照，也無本機 dot 目錄替代。
- 本輪只比對 Git、檔案／程式、docs 與容器狀態；正式站通知延遲、真實 LINE／新版 UI／DB 均未驗。現有容器未重建。
- 查核來源與邊界見 NOTIFICATION_DISCOVERY.md。未放寬門檻或自行宣稱已建立完整測試制度。

## 2026-11-11：main 3772bcf 一致性修正

合作人完整證據與指令看 [LINKED_RECORD_REVIEW.md](LINKED_RECORD_REVIEW.md)，實際 log 解析摘要 [linked-record-results.json](review/linked-record-results.json)。#17 為 main → wei、squash tree 與當時 main 相同；本輪由最新 main 建 fix branch，保留後續自動更新與 CSP／nonce。

- Node 85 通過／0 失敗／0 跳過；既有 Chromium 26、新一致性整合 20、推薦撤回 15 全通過，三組 pageerror=0。
- 新版 Docker build 成功；running container image 與 image tag 相同。lint／型別仍被既有設定跳過，不算通過。
- 真實 PostgreSQL 正反向指定寫入故障注入比對姓名／Email／updated_at 都回滾；兩個真正並行 HTTP 對同 Email 回 200/409，落敗者原資料保留。不是完整壓測或真實 outage。
- 這次明確授權後，先備份並實際還原，7 組資料計數一致，再套用 main 既有 trigger；function／trigger 已由唯讀 catalog 查核。本 PR 無新增 schema。
- 保留無登入舊工人與 LINE-only 空 Email；保留地址／機構／角色拒絕及 UI 清空拒絕後正常儲存皆驗。main 的 nonce CSP、閒置 focus 更新與編輯器跳過更新已驗。
- 未驗正式資料、真實附件、第三方 provider、iPhone、破壞性刪除、所有身份／壓力矩陣及改 Email 後舊 session UX。文件／案件 resync 保留既有 commit 後 follow-up，不能宣稱全域原子性。
- 本機 app 運作中；未合併 main、未部署。CI 以本次 PR 精確 head 為準，不沿用 #12/#17 的舊成功。

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

發佈讀回：候選 `78565a9` 已 push，GitHub commit API 確認第二個 parent 就是 main `aaab5fa`，compare API 為 ahead、behind_by=0，merge_base 同 main；但 PR 當次讀回仍回 mergeable=false／dirty 且沒有 checks。這是 GitHub PR 狀態與已讀回 ancestry 不一致的現象，尚未確認原因，不把它宣稱為 CI 通過或可合併。此紀錄只描述當次觀察，後續最新狀態以 PR 讀回為準。


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

## 2026-11-10 PR 候選重新驗證

- 使用者已授權提交、push 與建立 PR；來源 `feature/local-review-onboarding`，目標 `main`。下方「未 commit／push」為前輪歷史，實際發佈與 CI 狀態以 GitHub PR 為準；本輪不合併、不部署。
- 更正同步判斷：一般 `git fetch origin` 受本機 refspec 限制，沒有更新 main；改用 `git fetch origin refs/heads/main:refs/remotes/origin/main` 後確認最新 main 為 `f26ea46`，已包含近期文件模型與頁面重構。PR 有 5 個內容衝突（API、登入頁、HrManagement、HrMemberPortal、翻譯），保留 Draft，不自動覆蓋團隊更新。以下 local test 只驗證 e939b40 基底的 B 候選，不代表最新 main 整合通過。main 已移除 `.github` 目錄，因此本 PR 目前沒有 CI checks；前述部署 workflow 是舊基底狀態，非最新 main 現況。
- 本輪實跑 `node --test tests/hr-workflow.test.mjs`：19 通過、0 失敗、0 跳過；Docker Compose build 成功（lint／型別仍依既有設定跳過）。
- 重建僅 app 並讀回 image 一致後，重新執行 `scripts/verify-local-review.py`：20 通過、0 失敗、pageerror=0；配對五步皆由 UI 操作、逐步 API 讀回。前置工人／待審會員仍為 fixture。
- 只新增隔離虛構測試資料，不重設 DB／volume；先前資料計數及 image ID 是歷史快照，不代表目前累計。
- 驗收使用 localhost:8088，不連真實 LINE／Google。完整跨機構拒絕、真實文件、通知、iPhone、備份還原與既有安全缺口未因此放行。
- 注意：既有 Deploy workflow 在 push main 時可能觸發 self-hosted 部署；本 PR 不應在本機驗收前合併，也未修改該 workflow。


日期：2026-11-05。程式基底 e939b40，工作分支 `feature/local-review-onboarding`；未 commit／push／部署。最新操作入口為 `LOCAL_REVIEW.md`。

## 1. 本輪交付

- 管理端仲介機構改為可搜尋、依台菲類型篩選的目錄；可展開機構成員、責任、所屬雇主／工人、相關需求／案件與未指定業務提示。只整理既有 API 已授權回傳資料，不增加資料範圍。
- 會員登入先到角色化「工作起點」，新增獨立「需求與配對」，把人員／機構資料留在另一分頁；工人另可直接前往本人履歷。
- 共用五階段需求導覽與下一步提示；已額滿／取消的需求保留歷史，但不提供轉交、推薦、面試／錄用操作。這是 UI 防誤操作，沒有宣稱後端完整狀態機已重整。
- 新會員以 requestedRole 判斷尚未申請／已送審，修正既有會員 row 被誤認已送件；加入角色說明、三步指引與重新讀取審核狀態。審查／綁定／權限政策不變。
- 登入頁從既有 Auth.js providers API 取得可用登入方式，不再顯示未設定的 LINE／Google 按鈕；沒有變更 provider 設定或 secret。

## 2. 實際命令與結果

以下皆由 WSL 執行；應用程式與 PostgreSQL 在 Docker Desktop。

【WSL】

    node --test tests/hr-workflow.test.mjs
    git diff --check
    docker compose --env-file .env.review.local -f compose.review.yaml build app
    docker compose --env-file .env.review.local -f compose.review.yaml up -d --no-deps --force-recreate app

- Node：19 通過、0 失敗、0 跳過。覆蓋未選角色／待審／已核准、需求建立／轉介／推薦／面試、額滿／取消、額滿但尚未同步狀態、跨需求候選人不誤計、本人文件待辦及機構關係投影。
- Docker build：通過。最終 image 為 `tk-saas-sales-demo-review:workflow-b`，build 回傳 ID `sha256:1f485712e39961523da37a1bf24c9ac68a1cd75015f6e55df6629a46034b3729`。
- 重建僅 app，原 review DB container／volume 保留；舊需求與案件仍可讀。本輪沒有重灌 DB 或改 schema 檔。
- build 的 lint／型別檢查仍沿用原設定跳過；不能標為通過。Browserslist 過時警告仍在。

瀏覽器測試使用 profile scratch 中既有的獨立 Playwright Python venv，不新增應用執行依賴。可在任一已安裝 Playwright／Chromium 的 Python 環境執行相同測試；以下 `<playwright-python>` 是本輪該 venv 的 Python，不是要求在 Windows 跑程式。

【WSL】

    <playwright-python> scripts/verify-local-review.py

最終完整結果：20 項通過、0 失敗。不是沿用前輪 API-only 證據。

1. 管理者登入及授權 API。
2. 台灣仲介登入及授權 API。
3. 菲律賓仲介登入及授權 API。
4. 雇主登入及授權 API。
5. 工人登入及授權 API。
6. 新會員登入及授權 API。
7. 未設定的第三方登入按鈕不顯示。
8. 四種會員角色皆進入工作起點，菲律賓預設英文可切回中文。
9. 仲介名稱搜尋、無結果、台菲篩選、機構詳情。
10. 已額滿需求唯讀，台灣／菲律賓配對頁在 390px 沒有 document 水平溢出。
11. 建立並讀回虛構工人 fixture（使用既有 API，非 UI 建立）。
12. 雇主由畫面建立並分派需求，API 讀回。
13. 台灣仲介由畫面轉交需求，API 讀回。
14. 菲律賓仲介由畫面推薦工人，雇主 API 讀回。
15. 雇主由畫面確認安排面試，讀回 scheduled。
16. 雇主由畫面錄用，讀回 passed、正式案件與 filled；錄用按鈕消失。
17. 兩側仲介重新整理後不再顯示終止需求的轉交／推薦按鈕。
18. 新會員由畫面選雇主身分並送審，API 讀回 requestedRole。
19. 待審狀態重新整理／手動重讀後維持一致，不再出現送件表單。
20. 全部 context 捕獲 pageerror=0。

測試腳本固定 localhost:8088，先核對 Docker project label，才建立專用待審會員 fixture；不重設任何既有帳號。pending fixture 以隔離 DB 寫入建立，不代表真實 LINE 新註冊流程已驗證。配對的五個操作皆為實際按畫面按鈕，只有前置工人與待審會員是 fixture。

最終讀回隔離測試資料為會員 16、工人 7、案件 8、需求 3；這是檢查當下的累計資料，不把每個既有案件都算成本輪建立。另保留 `review.guide@example.invalid` 為尚未申請的新會員體驗帳號，密碼仍讀本機環境檔，不公開。

## 3. 中途失敗與修正

瀏覽器腳本前三次嘗試因測試定位失敗中止，並非宣稱一次全部通過：

- 起初沒有等待菲律賓角色載入後的自動英文效果，接著又誤用畫面「中文」文字作 button accessible name；該按鈕 aria-label 實際為 Switch to Chinese。改為等待角色分頁及使用正確 accessible name。
- 仲介類型 select 的 label 包含 option 文字，exact label 比對找不到；改用可匹配巢狀表單標籤的定位。
- 這些中止都發生在配對／申請資料寫入之前。修正的是測試腳本，不曾為了讓測試通過而跳過產品斷言。
- 修正後先完整通過一次；小幅補上工人履歷捷徑與截圖 scroll top 後，重新 build／重建 app，再完整通過上述 20 項。

## 4. 畫面證據

- `docs/review/b-agency-directory.png`：管理端仲介關係總覽。
- `docs/review/b-taiwan-mobile.png`：台灣仲介已額滿需求唯讀，390px。
- `docs/review/b-philippines-mobile.png`：菲律賓仲介已額滿需求唯讀，390px。
- `docs/review/b-employer-matching.png`：雇主需求五階段與額滿狀態。
- `docs/review/b-new-member-choose.png`：新會員三步指引與角色選項，390px。
- `docs/review/b-new-member-waiting.png`：送審後狀態與重新確認按鈕。

已實際載入截圖檢視管理端機構詳情、新會員窄螢幕與雇主需求導覽；所有截圖只包含虛構資料。前輪無 `b-` 前綴的截圖保留為改版前紀錄。

## 5. 範圍與風險界線

未改 schema、認證政策、管理權限、provider secrets、Production 或 LINE。API 僅修改 pendingApproval 狀態旗標；沒有使會員自動核准，也沒有增加任何資料讀取權限。

前輪 worker 文件審查越權、追蹤 ACME 私鑰、依賴弱點與資料揭露政策仍待獨立安全工作，不因 B 功能通過就放行真實個資。

未驗證：真實 LINE／Google、iPhone／LINE WebView、Filipino、完整跨機構拒絕矩陣、agency admin 全流程、真實文件上下載、通知送達、並行錄用競爭、DB 備份還原、Windows 瀏覽器實機與 CI。取消需求的停用邏輯經 Node 測試，未額外建立取消需求做真人瀏覽器操作。
