# ROADMAP｜main 整合後的本機驗收

本文件是唯一計畫主檔；操作看 LOCAL_REVIEW.md、證據看 VERIFICATION_REPORT.md、歷史看 TASK_LOG.md。

## 2026-11-12：通知／UI 驗證現況，方向待確認

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
