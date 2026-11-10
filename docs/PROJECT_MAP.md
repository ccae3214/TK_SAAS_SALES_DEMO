# PROJECT_MAP｜目前 main 整合候選的專案地圖

目前基底：main `756b2b8`，整合於 `feature/local-review-onboarding`，不直接修改 main。PR #12：https://github.com/ccae3214/TK_SAAS_SALES_DEMO/pull/12 。下列描述是目前程式責任，不代表完整權限／正式資料驗收已通過。

唯一操作入口：LOCAL_REVIEW.md；計畫：ROADMAP.md；進度：TASK_LOG.md；實證：VERIFICATION_REPORT.md。COMPARISON_WITH_LINE_HR_PILOT.md 是 ed3c2ab 的歷史快照，不能當最新功能或安全現況。

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

## HR 主要程式

| 路徑 | 責任 |
| --- | --- |
| src/app/api/hr/route.js | schema initializer、HR 讀寫、雇主需求／直接選工、管理者指派、菲律賓推薦、面試／錄用；B 差異僅 pendingApproval 旗標 |
| src/lib/hr-access.js、src/auth.js、src/lib/security.js | main 的身分、session、角色與 request 保護；未因 B 擴充權限 |
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
- .github/workflows/ci.yml／deploy.yml：main 756b2b8 恢復的 CI build／self-hosted 部署；不由 B 改動，PR checks 及部署必須分開判讀。

- src/lib/hr-audit.js、src/app/api/hr/admin-audit/route.js：756b2b8 的管理者稽核 wrapper、查詢與 schema；原樣保留，已驗端點 admin／非 admin／匿名授權，未全面驗稽核寫入。

## main 併入的新檔／移除

上述工作者進度、履歷元件、worker document migration、HR agency-workers API、rich menu 圖片（public/line-rich-menus/*）等均由 main 帶入。main 的既有輔助檔 unify-hr-terms.mjs 不在本輪執行；不能因檔案存在就宣稱已套用。main 分批刪除 admin-search-bars.patch、fix-member-role-change.patch、apply-worker-progress-feature.mjs、google-login-fix.patch、admin-audit-log.patch 與 scripts/cleanup-orphan-duplicates.sql，沿用其清理。756b2b8 的管理端刪除功能原樣保留，但本輪沒有執行刪除。

main 已刪除舊 ACME 帳戶憑證目錄、certbot_www/.gitkeep、舊展示圖片；沿用其刪除，不復原或複製私鑰。既有 Git 歷史是否含敏感資料及是否需撤銷／輪替須另評估，不能因目前檔案刪除就宣稱歷史乾淨。

原部署 docker-compose.yml／nginx.conf／.env.example 及一般商店、筆記、品牌檔案均沿用 main。本輪沒有新建其他產品目錄或啟動其外部服務。
