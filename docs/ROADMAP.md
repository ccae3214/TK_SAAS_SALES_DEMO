# ROADMAP｜main 整合後的本機驗收

本文件是唯一計畫主檔；操作看 LOCAL_REVIEW.md、證據看 VERIFICATION_REPORT.md、歷史看 TASK_LOG.md。

## 本輪實作計畫：會員送審通知與可重跑流程驗證

起始基底 main `809259b`，後續依使用者「遵循 main」整合 `52b0d7c`、解衝突並重建／重測；工作分支 `feature/hr-member-request-notifications`。使用者已確認 A 輕量可靠版、送出申請觸發、全站 admin 收件（含最高、不含仲介管理者），以及固定流程回歸＋AI 輔助探索。

### 範圍與驗收

1. 先恢復可版本控制的 HR 驗證入口，依目前 main 的權限／互貿／訓練規則盤點，不為通過而刪斷言或放寬門檻。本輪新 E2E 先聚焦會員閉環，其他新功能不冒稱全面通過。
2. 站內待審摘要與主表單資料分離；前景輪詢間隔目標 5 秒，回到分頁補抓，顯示待審數與進入正確會員的入口。更新不得覆蓋正在編輯的表單；聊天室 API 失敗不能把會員提醒清為零。實際延遲另量測，不以輪詢設定冒稱延遲已通過。
3. 會員送審與 LINE 通知入列共用 DB transaction；同一新會員送審重送不重複入列。舊待審資料可出現在站內摘要，但不自動重播歷史 LINE 通知；不另新增會員退回／撤回流程。
4. 接收者依既有伺服器有效 admin 權限與可用 LINE 身分取得並去重，包含環境最高管理者；仲介管理者及一般會員不收。Email-only 管理者只有站內提醒，不假造 LINE 綁定；送出前重查權限／綁定，不改既有角色授予規則。
5. 已依本輪明確批准新增 `hr_notification_outbox` 一張表及必要索引／唯一鍵，保存事件鍵、最小路由、處理狀態、嘗試次數、重試／租約時間及安全錯誤／嘗試紀錄。不保存文件內容或自由文字；LINE 只帶最小提醒與需要登入的審核入口。只在已批准的本機隔離 DB 套用；正式 DB 不在授權內。
6. 投遞使用可重試、去重與有界失敗處理；業務送審成功不因 LINE 平台錯誤回滾。分開記錄入列、API 接受、失敗／待重試，不能把 API 成功稱為手機已收到／已讀。
7. 用 Playwright Test 保存跨角色真實 UI 腳本及結果查核；測正常送審→管理者站內提醒→正確會員審核→核准→申請人重讀已核准身分，以及重送、越權、取消、重整、通知失敗／重試。LINE 先用明確的測試傳輸；真實接收另驗，不混用 accounting-bot。
8. 提供可重跑指令、測試報告／失敗 trace，記錄實際通過／失敗／跳過；AI 僅協助探索與產案例，不自行改驗收預期。fixture 僅虛構且彼此隔離，不重設既有會員／volume，不在正式環境測試。

### 執行順序與授權 gate

- [x] 讀最新 main／docs，確認已選方向；由 origin/main 建 feature branch，保留先前查核文件。
- [x] 本輪已批准新增通知表／索引與隔離 DB 的 main 既有 schema；先備份並實際驗證還原，7 組計數一致，無 DB／table 移除。
- [x] 恢復基線與新增單元（110 通過），完成同交易入列、角色限定摘要、安全投遞與可重跑腳本。
- [x] 最新候選 Docker build、真實 PostgreSQL 13／桌機與手機 E2E 16 通過；語言入口與通知遮擋亦檢查，其他完整業務矩陣未冒稱通過。
- [x] 同步 README／操作／地圖／紀錄與 MEMBER_NOTIFICATION_REVIEW、機器證據；只交付本機 feature branch。
- [x] 已授權更新 Draft PR #22；依 main 解三個衝突，先備份／實際還原再於隔離 DB 套用 onboarding_seen 欄位。測試配合新版首頁／導覽，110／13／16 最終均通過；GitHub 精確 head／CI 與獨立 review 仍以 PR 為準。
- [ ] main 合併、正式 schema／worker／LINE 發送與部署仍須另行批准；不因本機整合通過自動放行。既有依賴 audit 15 項另案評估，不擅自升級。

## 2026-11-12：通知／UI 驗證現況（前輪查核）

- 已查證 #18 合併，最新查核 main=809259b；新訓練中心、互貿認證、記帳 Bot 不在上一輪受測版本。
- scripts／tests 已從 main 刪除，docs 仍有失效入口；尚未擅自還原測試或把舊數據外推。
- 已確認提醒 30 秒輪詢、管理資料 focus 更新、新會員待審提醒與管理者 LINE 推播尚未串接；正式站延遲未實測。
- 現況證據見 NOTIFICATION_DISCOVERY.md；使用者已選 A 輕量可靠版及會員送審觸發。收件範圍先盤點權限，測試要求為可重跑的跨角色流程、減少手動操作；工具／策略仍在討論，未形成已批准實作計畫或 schema 授權。
- 本輪無產品、schema、認證、LINE 或部署異動。

## 2026-11-11：main 基底修正與 PR 交付（歷史，#18 已合併）

- [x] 查證 #17 是 main → wei 的 squash，同 tree，未發現同步退版；保留 main 後續自動更新與 CSP／nonce。
- [x] 從最新 main `3772bcf` 建 fix/hr-linked-record-consistency，不直接寫 main，以 main 為 PR 目標。
- [x] 取得本次隔離 DB 既有 trigger 與保留管理者 Email 防護授權；備份並實際還原，7 組資料計數一致。
- [x] 共同交易修正正／反向同步，Email 驗證、機構範圍與已批准的保留地址防護，保留 LINE-only／無登入舊工人相容。
- [x] Node 85、既有 Chromium 26／撤回 15／新整合 20 通過；新版 Docker build 與 image 讀回一致；app 運作中。
- [x] 合作人報告 LINKED_RECORD_REVIEW.md、機器摘要 review/linked-record-results.json、操作／紀錄／地圖同步。
- [ ] 本次 PR 發佈與精確 head CI 結果以 PR 讀回為準；合作人獨立審查／Windows 手動驗收。
- [ ] 真實 provider／iPhone／完整安全矩陣與 Email 改名 session 生命週期另案；不合併 main、不部署。

## PR #12 已批准並完成：撤回推薦（歷史）

- [x] 僅所屬菲律賓仲介、仲介來源、需求 open、尚未安排面試的人選可撤回；不實體刪工人或推薦歷史。
- [x] 狀態／機構與來源在伺服器重新驗證、candidate/order row locks、冪等；過時雇主面試／推薦更新不得復活。
- [x] Node 55、Chromium 回歸 26／專項 15 通過；包含真實 DB 的跨機構與並行互斥。
- [x] 更新既有 PR #12，附合作人 REVIEW_REPORT.md 自我審查與證據；CI 結果以精確 head 為準。
- [ ] 合作人獨立 code review／Windows 手動複驗；合併 main／部署仍需另行批准。

## 前輪已完成

- [x] main `e0e5a71` 整合到 `feature/local-review-onboarding`，解決五個內容衝突；不直接寫 main。
- [x] 保留 main 的工作摘要、完整會員申請與機構選擇、訓練中心、履歷／文件重構及雇主直接選工。
- [x] 接入 B：仲介關係目錄、工作起點、獨立需求與配對、五階段導覽、額滿／取消唯讀與待審重讀。
- [x] 經使用者批准，停止 app、備份、實際還原至獨立驗證 DB，再對隔離 review DB 執行既有 migration。
- [x] Docker build、Node 35 項及 Chromium 26 項通過；不把跳過的 lint／型別算通過。
- [x] 同時測管理者指派→菲律賓推薦→面試→錄用，及雇主直接挑選→面試→錄用；逐步 API 讀回。
- [x] 留下未錄用工人與已指派的 open 需求供手動驗收，不再讓自動測試耗盡全部人選。

## 下一步

1. Windows 瀏覽器於 localhost:8088 手動驗收，回報具體 UI 問題；不因未定位的美化建議阻擋交付。
2. PR #12 更新後讀回精確 head、base 與 CI；通過不等同正式放行，合併 main／部署須另行批准。
3. 若要正式環境／真實文件，另驗認證與跨機構拒絕矩陣、附件歷史遷移、通知可靠性、並行錄用、備份還原與安全缺口。

## 範圍界線

- DB 授權只限既有 Docker 隔離虛構資料庫 `tk_saas_review` 的備份、還原驗證與 main 既有 migration；未修改 migration SQL、正式 schema 或正式資料。
- 新會員保留 main 的所屬仲介與訓練中心選項，不縮回舊版只選角色。
- main 已移除台灣仲介手動轉交 API；採 main 現行雇主直接選工／管理者指派，不能為讓舊測試通過而恢復舊權限。
- 不改 secrets、不啟用外部 provider 或部署、不自動合併 main。
