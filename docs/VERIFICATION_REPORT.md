# VERIFICATION_REPORT｜B 三流程整理實際驗收

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
