# ROADMAP｜main 整合後的本機驗收

本文件是唯一計畫主檔；操作看 LOCAL_REVIEW.md、證據看 VERIFICATION_REPORT.md、歷史看 TASK_LOG.md。

## 本輪已批准並完成：撤回推薦

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
