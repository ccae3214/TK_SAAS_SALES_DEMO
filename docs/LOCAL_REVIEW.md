# LOCAL_REVIEW｜目前唯一的本機驗收入口

## 現在的候選

已整合 main `756b2b8` 到 `feature/local-review-onboarding`；PR #12：https://github.com/ccae3214/TK_SAAS_SALES_DEMO/pull/12 。未合併到 main、未部署。Node 35 項／Chromium 26 項通過，證據與限制看 VERIFICATION_REPORT.md。

Windows 只使用瀏覽器：http://localhost:8088/hr/login 。這是 Docker Desktop 的隔離虛構資料，不連真實 LINE／Google；不要啟動原部署 compose 來驗本 PR。

## 帳號與密碼

| 身分 | Email |
| --- | --- |
| 系統管理者 | review.admin@example.invalid |
| 台灣仲介業務 | test.agency.tw@example.com |
| 菲律賓仲介承辦 | test.agency.ph@example.com |
| 雇主 | test.employer01@example.com |
| 工作者 | test.worker01@example.com |
| 新會員（未申請則可填表） | review.guide@example.invalid |
| 已送審會員 | review.new@example.invalid |

密碼只在本機 repo root `.env.review.local` 的 `REVIEW_LOGIN_PASSWORD` 查看；不貼聊天／PR／Git。這是隔離 Demo 共用密碼，不是正式認證政策。普通分頁共用 cookie；每個角色先登出，或用獨立瀏覽器 profile。

## 最短手動驗收：菲律賓推薦

1. 以 `test.agency.ph@example.com` 登入；如為英文，可切回中文。
2. 點「需求與配對」，找到 `DEMO-手動推薦驗收`（本輪 ID 16）。
3. 在「推薦所屬工作者」選 `DEMO-手動推薦測試工人-A`（本輪 ID 10），按「推薦給雇主面試」。測試結束時已確認選項存在、按鈕可用，但沒有替使用者提交或錄用。
4. 登出，以雇主登入，找同一筆需求，安排面試→錄用；重整後確認案件存在、需求額滿、無後續挑選／錄用操作。
5. 兩側仲介重整，額滿需求保留歷史，菲律賓推薦表單不再出現。

此工人只能錄用一次；錄用後不再可推薦是正確結果。若已用完，Agent 可在已授權隔離 DB 補新的虛構 fixture，不可藉此放寬推薦規則或刪案件。

## main 的新版直接選工流程

main 已不再提供台灣仲介手動轉交；不要照舊版步驟尋找該按鈕。

1. 雇主在「需求與配對」建立家庭幫傭需求；所屬台灣仲介由既有雇主資料決定，不任意改選。
2. 從符合工作類型且尚未有案件的工作者中「挑選工作者」，系統建立兩側仲介關聯。
3. 安排面試、錄用，重整驗證案件與額滿狀態。
4. 另一條保留路徑：管理者在「媒合需求單」勾選菲律賓機構並儲存指派，再由該菲律賓仲介推薦。權限沿用 main，不恢復舊台灣轉交 API。

## 仲介目錄、新會員與手機版

- 管理者「仲介機構」：名稱／類型／國家搜尋、台菲篩選、詳情中的成員與責任、雇主／工人／需求／案件及未指派業務提示。
- 新會員：沿用 main 的類型＋所屬仲介表單（含訓練中心選項）。送審後維持待審，可重新確認狀態，不自動核准。`review.guide` 若已送審就應顯示待審，不會重設。
- 各角色預設「工作起點」，保留 main「工作摘要」；必要文件、履歷與來台程序沿用 main。
- 以 390px 窄視窗檢查工作起點／配對／新會員畫面；自動測已驗 document 無水平溢出，不等同 iPhone 或全部頁面視覺通過。

## 容器、資料與啟停

- Compose project：tk-saas-local-review。
- app：tk-saas-review-app，只發布 127.0.0.1:8088。
- DB：tk-saas-review-postgres／tk_saas_review，不發布主機 DB port。
- Volume：tk_saas_review_postgres_data，禁止 `down -v`。
- 既有隨機 DB、session、文件金鑰與登入密碼在忽略檔 `.env.review.local`，不得重新產生覆蓋。
- 本輪經使用者批准做備份／實際還原驗證，再讓 main 自動 migration 改隔離 DB。dump 不進 Git，還原驗證 DB 保留；正式 DB 沒有變更。

【WSL】（由 Agent 在 repo root 操作）

    docker compose --env-file .env.review.local -f compose.review.yaml ps
    docker compose --env-file .env.review.local -f compose.review.yaml start --wait

改程式後才重新 build／僅重建 app：

【WSL】

    docker compose --env-file .env.review.local -f compose.review.yaml build app
    docker compose --env-file .env.review.local -f compose.review.yaml up -d --no-deps --force-recreate app

## 自動驗證

【WSL】

    node --test tests/hr-workflow.test.mjs scripts/test-hr-requirements.mjs
    <playwright-python> scripts/verify-local-review.py
    git diff --check

`<playwright-python>` 為已安裝 Playwright／Chromium 的獨立 Python 環境。腳本固定 localhost:8088 並核對 Docker project；建立虛構待審會員／工人，實際點兩條配對 UI，再 API 讀回；最後準備未錄用人選與已指派 open 需求供人工驗收。不是唯讀，也不是完整真實註冊測試。

`local-review-bootstrap.mjs` 只允許 review DB，已有會員就拒絕重灌／重設密碼；本輪只驗證拒絕保護及語法，未再測空 DB 初始化。新電腦須由 Agent 核對與取得初始化／secrets 授權後處理，不直接貼用正式 DATABASE_URL。

main 已恢復 CI build／self-hosted Deploy workflows；GitHub checks 不會代跑本機瀏覽器流程。合併 main 可能觸發部署，不能因 local test 通過就直接合併。

未驗：真實 LINE／Google、iPhone／WebView、完整跨機構拒絕、agency admin 全流程、附件歷史遷移、真實文件上下載、通知送達、並行錄用、全新環境與正式備份還原。build 既有 lint／型別跳過、Browserslist 警告仍在。
