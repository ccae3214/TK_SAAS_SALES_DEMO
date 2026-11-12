# PROJECT_MAP｜目前 main 整合候選的專案地圖

起始基底 main `809259b`，已整合／驗證 main `7093129`，工作分支 `feature/hr-member-request-notifications`。使用者已批准本輪新增通知表及必要索引、僅在本機隔離 DB 套用 main 既有 schema 與虛構資料測試；先備份／實際驗證還原。不含正式 LINE、secrets、push、合併或部署。

## 本輪新增／恢復：會員送審閉環（本機已驗，未發布）

- src/lib/hr-notifications.js：通知表初始化、送審共同交易、有效 admin 收件、租約／重試與 LINE 安全結果分類。
- src/app/api/hr/notifications/route.js：全站 admin 專用、同 snapshot 待審摘要。
- src/components/HrMemberRequestNotifications.jsx、src/components/HrMemberRequestNotifications.module.css：獨立前景輪詢、失敗保留結果與待審入口。
- src/app/api/hr/member-request/route.js、src/components/HrManagement.jsx：送審入列、通知入口及登入後深連結。
- scripts/hr-notification-worker.mjs、Dockerfile、compose.review.yaml：預設停用、明確開啟的背景投遞；本機無 LINE token。
- playwright.config.mjs、scripts/review-browser-proxy.mjs、tests/e2e/：桌機／手機 Chromium 的可重跑流程；proxy 僅測試時維持原本 localhost callback origin。
- tests/hr-linked-record-store.test.mjs、tests/hr-candidate-withdrawal.test.mjs、tests/hr-workflow.test.mjs、scripts/test-hr-requirements.mjs：從 #18 精確受測 Git 內容恢復原 85 項基線，未削弱斷言；最新 main 上已重跑 85 通過。
- package.json、package-lock.json：固定 Playwright Test 1.65.0；保留既有跨平台鎖定項，不順帶更新產品依賴。
- tests/hr-notifications.test.mjs、tests/support/review-fixtures.mjs、scripts/test-notification-store.mjs：新單元、隔離 fixture 與真實 PostgreSQL 失敗／併發驗證；110 項單元、13 項真實 DB、16 項桌機／手機 E2E 均通過。
- scripts/prepare-notification-review.mjs：保留 fresh／pending 虛構帳號，不重設既有資料。
- src/lib/hr-translations.jsx：可選 inline 語言工具，僅管理後台改為側欄頂部，避免遮擋通知；其他頁預設不變。
- docs/MEMBER_NOTIFICATION_REVIEW.md、docs/review/member-notification-results.json、docs/review/member-notifications-desktop.png、docs/review/member-notifications-mobile.png：本輪自我審查與安全證據。
- .github/workflows/ci.yml：加 HR 單元執行，未把尚未執行的遠端 CI 稱為通過。

唯一操作入口：LOCAL_REVIEW.md；計畫：ROADMAP.md；進度：TASK_LOG.md；實證：VERIFICATION_REPORT.md。COMPARISON_WITH_LINE_HR_PILOT.md 是 ed3c2ab 的歷史快照，不能當最新功能或安全現況。

## 本輪新增：現況查核

- docs/NOTIFICATION_DISCOVERY.md：新會員通知的觸發／更新機制、docs 失效路徑、歷史驗證界線，沒有已批准產品決策。
- src/components/HrReminders.jsx、src/lib/use-auto-refresh.js：既有提醒輪詢與focus節流，本輪未修改。
- src/app/api/hr/member-request/route.js、src/lib/hr-line-bot.js：既有送審／核准通知，尚無新申請通知管理者，本輪未修改。
- src/components/HrTrainingCenterWorkspace.jsx、src/app/api/hr/training-center/route.js：main 新增訓練中心入口／API，本輪未驗。
- src/components/HrAgencyCertifications.jsx、src/app/api/hr/agency-certifications/route.js、src/lib/hr-agency-certification*.js：main 新增互貿認證，規則看 AGENCY_CERTIFICATION.md；測試入口警示見該文件。
- accounting-bot/、accounting-bot/README.md：另一官方帳號、獨立容器／SQLite 的帳單機器人，不混用 HR 通知。

## 歷史新增：會員／工人／雇主一致性（部分測試檔已被 main 刪除）

- src/lib/hr-linked-record-store.js：正反向共同交易、member-first 鎖定、租戶查核、Email 與保留地址驗證、錯誤 rollback/release。
- tests/hr-linked-record-store.test.mjs：30 個新增單元／交易替身測試；與既有 55 合計 85。
- scripts/verify-linked-records.py：固定隔離容器／DB，20 項真實 UI／API／PostgreSQL 故障與併發驗證，包含 main 自動更新／CSP 保留檢查。
- docs/LINKED_RECORD_REVIEW.md：本輪合作人自我審查、merge 方向／tree 查核、完成項目、手動步驟與殘餘風險。
- docs/review/linked-record-results.json：從實際 log 解析的最終摘要，不含憑證。
- src/app/api/hr/route.js：本輪 5 個正向編輯與反向 member-profile 接線；既有角色／機構限制、推薦與主流程保留。
- src/lib/hr-translations.jsx：本輪驗證／保留 Email／作用範圍錯誤的英文對照。

## 架構與執行環境

- Next.js App Router／React／Auth.js／pg，`server.js` 啟動 HTTP＋Socket.IO。
- WSL 操作 Docker Desktop；Windows 只用瀏覽器。驗收使用 compose.review.yaml 的隔離 app／PostgreSQL，localhost:8088；不啟動正式 compose 的 Nginx、DDNS 或 notebook。
- 本機 secrets 在忽略檔 .env.review.local，不在本地圖列值、不進 Git。備份 dump 位於 Agent profile 外部 backups 目錄，不在 repository。
- HR 角色及權限沿用 main，包含 training_center／system_admin／admin_scope；這些不是 B 自行新增政策。

## 網頁入口

| 路徑 | 程式／責任 |
| --- | --- |
| /hr/login | src/app/hr/login/page.jsx、login.module.css：沿用 main 新登入 UI，僅顯示已設定 provider |
| /hr | src/app/hr/page.jsx：依身分分流管理端／會員端 |
| /hr/workers/[id] | src/app/hr/workers/[id]/page.jsx：main 的工作者進度入口 |
| / | src/app/page.jsx：品牌與產品展示 |
| /admin、/notes、/checkout、/demo/* | 原有商店／筆記／展示，非本輪 HR 驗收範圍 |

## 本輪新增檔案：推薦撤回

- src/lib/hr-candidate-withdrawal.js：純狀態／顯示與既有 notes 事件標記。
- src/lib/hr-candidate-withdrawal-store.js：伺服器交易、機構／來源與狀態判定、鎖定、冪等。
- src/components/HrRecommendationHistory.jsx：撤回按鈕、歷史與 readonly 結束需求。
- tests/hr-candidate-withdrawal.test.mjs：20 項單元／交易替身測試。
- scripts/verify-recommendation-withdrawal.py：固定隔離環境，15 項 UI／真實 DB／HTTP 授權及競爭查核。
- docs/REVIEW_REPORT.md：合作人用自我審查、實測證據與放行限制。
- docs/review/recommendation-withdrawal.png：390px 寬度撤回歷史截圖，僅虛構資料。

## HR 主要程式

| 路徑 | 責任 |
| --- | --- |
| src/app/api/hr/route.js | schema initializer、HR 讀寫、雇主需求／直接選工、管理者指派、菲律賓推薦、面試／錄用；B 待審旗標，另有本輪批准的撤回 action、來源欄位與防復活保護 |
| src/lib/hr-access.js、src/auth.js、src/lib/security.js | main 的身分、session、角色與 request 保護；既有角色不變；本輪另經批准限定菲律賓仲介撤回 action |
| src/components/HrManagement.jsx／module.css | 保留 main 管理搜尋、履歷、文件審核等；接入仲介目錄、流程與桌面／手機額滿控制 |
| src/components/HrMemberPortal.jsx | main 會員表單與所屬機構、工作摘要、履歷、文件、選工；B 加工作起點、獨立配對分頁與待審重讀 |
| src/components/HrAgencyDirectory.jsx | 仲介名稱／國家／類型搜尋、台菲篩選、授權資料的關係詳情 |
| src/components/HrJourney.jsx／HrJourney.module.css | 工作起點與五階段流程投影；移除舊未使用 MembershipGuide，申請只保留 main 完整表單 |
| src/lib/hr-workflow.js | 純呈現狀態、容量／終止需求與機構關係，不授予權限、不寫資料 |
| src/lib/hr-translations.jsx、src/context/LanguageContext.jsx | main 中英翻譯及 B 流程字串，並非三語完整替代 |
| src/components/HrDocumentReviewList.jsx | main 新版行動文件審核清單 |
| src/components/HrResumeFieldControl.jsx、HrPhotoCropper.jsx／CSS、HrFilePicker.jsx／CSS | main 履歷欄位、裁切與檔案選擇 |
| src/lib/hr-resume-fields.js、hr-resume-import.js | main 履歷選項與 PDF 匯入 |
| src/components/HrWorkerProgress.jsx／CSS、HrWorkerProgressLink.jsx | main 工作者進度頁與入口 |
| src/lib/hr-worker-progress.js、hr-worker-progress-text.js、hr-worker-stages.js | main 工作者進度狀態、日期規則、分階段文字 |
| src/components/HrReminders.jsx／CSS、HrChat.jsx／CSS | main 提醒、補資料入口及聊天；不等同已驗證的外部通知送達 |
| src/lib/use-hr-dialog.js | main 對話框工具 |
| src/lib/hr-line-bot.js、src/app/api/line/webhook/route.js | main LINE 查詢／圖文選單等；本機未設定外部 provider、不作真人驗收 |

## 文件模型與 API

- src/lib/hr-requirements.js：main 的文件適用性、前置文件、案件證照。
- src/lib/hr-worker-documents-schema.js：main 的案件→工作者文件遷移、重複文件合併及案件證照；B 不修改此 SQL。
- src/app/api/hr/documents/route.js、documents/[submissionId]/route.js：main 的加密上傳／授權查看與審核資料。
- src/app/api/hr/agency-workers/[id]/route.js：main 的機構工作者進度 API。
- src/app/api/hr/workers/[id]/resume-photo/route.js：main 履歷照片 API。
- src/app/api/hr/member-request/route.js：main 會員類型＋所屬機構送審；不回復舊的只選角色政策。
- src/app/api/hr/chat/route.js：聊天室資料。
- 重要表：hr_members／hr_agencies／hr_workers／hr_employers；hr_job_orders→hr_job_order_agencies→hr_job_order_routes→hr_job_order_candidates→hr_cases；hr_worker_documents→hr_document_submissions／files／reviews；hr_case_certifications；工作者／案件進度與聊天表。
- 某些登入 GET 也會執行 schema／資料更新，不是純讀。遷移前先取得指定 DB 授權；本輪只改已批准的 review DB，正式 DB 未動。

## 本機工具與驗證

- compose.review.yaml：固定 project、容器與 volume 的隔離測試站，不修改原部署拓樸。
- scripts/local-review-bootstrap.mjs：限定 review DB 的初始化；已有會員即拒絕重灌；更新為 main initializer 與 migration 相依注入，來源標記失配即拒絕。
- scripts/seed-hr-role-tests.js：main 的虛構資料 seed，含寫資料／重設密碼行為，不可當唯讀測試任意執行。
- scripts/verify-local-review.py：固定本機及 project 的 Playwright；六角色、兩條配對 UI、API 讀回、新會員、文件頁、390px、稽核 endpoint 授權、未耗盡的手動 fixture。
- tests/hr-workflow.test.mjs：B 投影與 main 功能保留回歸，23 項。
- scripts/test-hr-requirements.mjs：main 文件適用性／證照測試，12 項。
- docs/review/b-*.png：本輪重新產生的虛構資料畫面；無 b- 前綴圖片是前輪歷史。
- .github/workflows/ci.yml／deploy.yml：main e0e5a71 恢復的 CI build／self-hosted 部署；不由 B 改動，PR checks 及部署必須分開判讀。

- src/lib/hr-audit.js、src/app/api/hr/admin-audit/route.js：e0e5a71 的管理者稽核 wrapper、查詢與 schema；原樣保留，已驗端點 admin／非 admin／匿名授權，未全面驗稽核寫入。

## main 併入的新檔／移除

上述工作者進度、履歷元件、worker document migration、HR agency-workers API、rich menu 圖片（public/line-rich-menus/*）等均由 main 帶入。main 的既有輔助檔 unify-hr-terms.mjs 不在本輪執行；不能因檔案存在就宣稱已套用。main 分批刪除 admin-search-bars.patch、fix-member-role-change.patch、apply-worker-progress-feature.mjs、google-login-fix.patch、admin-audit-log.patch 與 scripts/cleanup-orphan-duplicates.sql，沿用其清理。e0e5a71 的管理端刪除功能原樣保留，但本輪沒有執行刪除。

main 已刪除舊 ACME 帳戶憑證目錄、certbot_www/.gitkeep、舊展示圖片；沿用其刪除，不復原或複製私鑰。既有 Git 歷史是否含敏感資料及是否需撤銷／輪替須另評估，不能因目前檔案刪除就宣稱歷史乾淨。

原部署 docker-compose.yml／nginx.conf／.env.example 及一般商店、筆記、品牌檔案均沿用 main。本輪沒有新建其他產品目錄或啟動其外部服務。
