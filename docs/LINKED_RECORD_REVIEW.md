# REVIEW REPORT｜會員與工作者／雇主資料一致性修正

日期：2026-11-11。受測基底：main `3772bcfc5a584c4c70d28ec1bdb85abddfe6ba6f`。
本文件為實作者自我審查與執行證據，不是合作人的獨立核准。精確候選 SHA／CI 請看本次 PR；測試摘要見 [linked-record-results.json](review/linked-record-results.json)。

## 1. merge／退版查核結論

- #12 已合併到 main；#17 的實際方向是 **main → wei**，不是 wei → main。
- #17 採 squash，只有一個 parent，不能用 `mergeCommit^2` 判斷來源。GitHub 記錄 head=`2d56a90`，完成 commit=`cded102`。
- `git diff --exit-code 2d56a90 cded102` 為 0，兩者 tree hash 相同；沒有看到這次同步把舊 wei 覆蓋回 main。
- #17 顯示 109 檔變更是相對舊 wei 的累積差異，不代表 109 檔退版。當時舊 wei 落後 main，不能只用 diff 檔案數或 squash ancestry 判斷功能流失。
- main 後續是 `4f66df6` 分頁回來時自動更新、`3772bcf` CSP／nonce 調整；本輪從最新 main 另開 `fix/hr-linked-record-consistency`，不是直接寫 main，也不再以 wei 作 PR 目標。
- 推薦撤回、文件遷移、照片讀取、會員同步均保留；本輪沒有改 initializer、middleware、layout、照片元件、自動更新 hook 或既有推薦邏輯。既有兩組 E2E 已在本輪重跑，另驗新 main 的 CSP 回應、閒置 focus 更新與開啟編輯器時略過更新。

結論限於上述快照、tree 查核及已列測試：**未發現 #17 導致退版**。不是宣稱所有頁面／正式環境均無缺陷，也沒有證據可判斷任何人的操作動機。

## 2. 功能說明／完成項目

- 已綁 Email 登入的工人／雇主不可清空 Email，格式不合法回 400；前後空白／大小寫統一正規化。
- 工人或雇主與會員名稱／Email／啟用狀態改用同一 PostgreSQL client／transaction。任何一段失敗會回滾，不留下部分寫入。
- 管理端反向編輯會員→工人／雇主也使用同一交易，並在鎖定後重讀目標管理者保護條件。
- 保留機構範圍與既有角色限制：跨機構 404；不允許角色仍拒絕。沒有放寬推薦或錄用規則。
- 一般工人／雇主建立或編輯不得改用 ADMIN_EMAILS／HR_ADMIN_EMAILS 的保留地址；即使該地址還沒有 hr_members 也拒絕。不改現有合法管理者登入；已綁定同一保留地址可維持原地址。
- 保留未綁會員的舊工人空聯絡 Email，以及既有 LINE-only／NULL email 語意；管理端明確切為 LINE-only 時同步清除工人聯絡 Email，而不是 COALESCE 留舊值。
- 同步中英錯誤文字；新增單元／交易測試與固定 localhost 的真實 UI／API／PostgreSQL 驗證。

## 3. 變更導讀

| 路徑 | 審查重點 |
| --- | --- |
| src/lib/hr-linked-record-store.js | Email 正規化與保留地址、member-first 鎖定、機構範圍查核、共同交易、rollback/release、callback 回傳 id 防護 |
| src/app/api/hr/route.js | 5 個工人／雇主編輯分支及反向 member-profile 接線，建立入口保留地址防護、typed 400/403/404/409 |
| src/lib/hr-translations.jsx | 新錯誤訊息的英文對照 |
| tests/hr-linked-record-store.test.mjs | 30 個新增單元／交易替身測試，含既有管理地址、LINE-only、租戶、失敗、反向同步 |
| scripts/verify-linked-records.py | 本機虛構 fixture、真實登入、HTTP、DB rollback、併發及 UI；拒絕非預期容器／DB |
| docs/review/linked-record-results.json | 從本次實際 log 解析的最終測試摘要，無憑證或個資 |
| README、LOCAL_REVIEW、ROADMAP、TASK_LOG、PROJECT_MAP、VERIFICATION_REPORT、REVIEW_REPORT | 更新唯一入口與狀態，舊 PR #12 測試標為歷史 |

## 4. 交易／安全取捨

- 先鎖會員，再鎖工人／雇主，與 main 的會員 active trigger 寫入方向一致；在交易內再次檢查作用範圍與 Email 衝突。
- 工人／雇主寫入 callback 與會員更新不得各用 pool.query；反向更新亦共用一條連線。錯誤時 rollback，finally release。
- 同 Email 兩個並行 HTTP 更新：驗到一方 200、一方 409；成功者與失敗者各自的會員／工人仍一致。這不是完整壓力／所有舊 writer 的競態驗證。
- DB fault injection 只在 exact store 的 query wrapper 指定一段 UPDATE 拋錯，其他 SQL 真的由 PostgreSQL 執行；逐欄比對姓名、Email、updated_at 全回復。不是在正式 DB 製造故障，也沒有建立測試 trigger。
- 已批准的保留 Email 防護針對工人／雇主資料入口，不是整個認證系統重構；真實 provider、舊 session Email 改名後的生命週期、其他非綁定角色的管理入口仍需另案審查。
- 文件適用性／案件階段 resync 保留原有 commit 後 follow-up，未納入本次工人／會員交易；該 follow-up 若失敗，核心兩筆仍一致，但 API 可能回失敗。本 PR 不宣稱所有附帶工作全域原子化。
- 本 PR 無新增 migration／DDL；本機先經此次批准備份、實際還原，再套用 main 既有 initializer／trigger，不是修改其 SQL。

## 5. 實際驗證

以下均在 repo root、WSL 執行；`PLAYWRIGHT_PYTHON` 指向已安裝 Playwright／Chromium 的 Python。本輪使用既有隔離 browser venv，不新增正式依賴。

【WSL】

    node --test tests/hr-linked-record-store.test.mjs tests/hr-candidate-withdrawal.test.mjs tests/hr-workflow.test.mjs scripts/test-hr-requirements.mjs
    docker compose --env-file .env.review.local -f compose.review.yaml build app
    docker compose --env-file .env.review.local -f compose.review.yaml up -d --no-deps --force-recreate app
    "$PLAYWRIGHT_PYTHON" scripts/verify-linked-records.py
    "$PLAYWRIGHT_PYTHON" scripts/verify-local-review.py
    "$PLAYWRIGHT_PYTHON" scripts/verify-recommendation-withdrawal.py
    node --check src/app/api/hr/route.js
    git diff --check

| 檢查 | 最終結果 |
| --- | --- |
| Node（既有 55＋新增 30） | 85 通過、0 失敗、0 跳過 |
| 新一致性 UI／API／PostgreSQL | 20 通過、0 失敗、pageerror=0 |
| 既有 Chromium 回歸 | 26 通過、0 失敗、pageerror=0 |
| 推薦撤回專項 | 15 通過、0 失敗、pageerror=0 |
| Docker build | 成功；running image ID 與 image tag 讀回一致 |
| 備份／實際還原 | 7 組計數一致；來源在備份階段未變動；dump／還原 DB 保留 |
| 語法／diff | 通過 |
| lint／型別 | 被既有 build 設定跳過，不算通過 |
| GitHub CI | 以本次 PR 精確 head checks 為準，不沿用 #12/#17 的舊結果 |

備份時虛構資料計數：會員 27、工人 43、雇主 5、案件 28、需求 35、必要文件 924、上傳 0。來源與還原驗證 DB 全部一致；沒有真實附件，不能外推附件遷移完整性。備份存 Agent 的私有外部目錄，不進 Git。

中途有三類驗證失敗，已定位並完整重跑，未削弱斷言：
1. fixture 工人與雇主用了同一 suffix 的 Email，409 是預期重複保護；加入 kind，避免測試互撞。
2. 單字 fixture 名稱沒有既有表單要求的姓氏，瀏覽器原生驗證未發出 PATCH；補填姓名並新增等待真實 PATCH=400 的斷言。
3. 重整後預設回工作起點，原測試在錯分頁找按鈕；明確切回基本資料，不變更產品導覽。

自我審查另發現 admin 的 name/type 驗證不能從交易 callback 回傳 NextResponse 當成功資料；已移到交易前，增加真實 HTTP 400／無寫入驗證及 callback id 防護。

## 6. 合作人手動測試步驟

【Windows】瀏覽器 http://localhost:8088/hr/login

1. 用原本隔離測試帳號登入；密碼只讀本機忽略的 `.env.review.local`，不要貼 PR／聊天。切角色用獨立 profile 或先登出。
2. 工人「基本資料 → 編輯履歷」，姓名填妥後清空 Email 儲存：應顯示錯誤，重整後原登入 Email 保留；改回同一 Email 的大寫形式可儲存並回到小寫。
3. 雇主編輯基本資料，清空 Email 同樣應拒絕；仲介只能改自己所屬的工人／雇主。
4. 管理端編輯同一人的姓名，重整會員與工人／雇主兩邊應一致；反向編輯會員名稱與有效 Email 也應一致。改 Email 後使用新地址重新登入；舊 session 的 UX 尚未改造。
5. 試圖透過工人／雇主建立或編輯填入保留管理者地址，應拒絕，不產生新紀錄／部分變更。
6. 原推薦撤回、排面試／錄用限制仍保留；回到分頁可更新資料，開著編輯器時不應背景覆寫。

不要在手動驗收刪除工人／會員／案件，也不要直接 reset volume；本輪測試只建立新的虛構 fixtures。

## 7. 額外改動／建議事項與交付界線

- 額外改動僅包含反向同步原子性、LINE-only 相容、英文錯誤文案、文件／測試證據，皆服務同一一致性問題。沒有變更照片、自動更新、CSP、schema 或正式環境設定。
- 既有 E2E 會改寫大型歷史截圖，已另存本機測試證據後還原；不把數 MB 的新截圖混進本 PR。
- 建議後續讓 CI 執行 Node 測試，而非只有 build；本次不擅改 workflow 或驗收門檻。
- 建議另案檢查不可變會員 ID／Email 改名的 session 生命週期、所有登入來源與完整多機構矩陣；本次未假稱認證完整安全驗收。
- 真實 LINE／Google、通知、iPhone／LINE WebView、正式資料／真實附件、破壞性刪除、完整高併發與真實 DB outage 尚未驗證。
- 不合併 main、不部署；main 的 Deploy workflow 仍可能在合作人合併後自動執行，需由使用者另行決定放行。
