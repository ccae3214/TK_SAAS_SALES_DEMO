# 新會員通知與 UI／UX 驗證：現況查核

查核快照：main `809259ba21b87230fd97926d01373eceb0108a82`。
本輪僅閱讀程式／文件、Git 與容器狀態及驗證入口，不實作通知、不改 DB／權限、不送 LINE、不部署。

## 合併與文件現況

- #18 已合併，merge commit `31a9dd126fb5a9373a3f7aacb366158791c94986`。
- main 後續新增訓練中心／抵台流程、台菲仲介互貿認證、獨立 accounting-bot。它們不是上一輪 85／26／15／20 測試覆蓋的版本。
- `2940321` 刪除 scripts 目錄、`f3dcae2` 刪除 tests 目錄。這是 Git 已確認的變更；未判斷刪除動機或宣稱整體產品退版。
- README、LOCAL_REVIEW、PROJECT_MAP、VERIFICATION_REPORT 等仍指向不存在的 HR 測試與啟動腳本；AGENCY_CERTIFICATION 的套用腳本／測試檔也不存在。歷史操作紀錄可以保留，但不能當現行可執行驗證步驟。
- 本輪實跑 `node --test tests/hr-linked-record-store.test.mjs`，exit=1，原文 `Could not find 'tests/hr-linked-record-store.test.mjs'`。這是驗證入口失效，不是某項產品斷言失敗，也不是新版測試通過。
- 最新 CI 包含網站 build 與 accounting-bot pytest，沒有 HR 的 Node／瀏覽器回歸入口。
- 本機 review app 還在運作，但本輪未重建，不能把它視為最新 main 的 UI 驗收。未讓新 main initializer 接觸既有 DB。

## 新會員通知：已確認的程式行為

| 位置 | 現況 |
| --- | --- |
| src/components/HrReminders.jsx:147-174 | 每 30000ms 抓 `/api/hr` 與 `/api/hr/chat`；兩者一起成功才更新提醒，任一失敗會清空所有提醒 |
| src/components/HrReminders.jsx:176-183 | 提醒只含聊天室未讀、近期日期、基本資料待補；沒有會員申請待審項目 |
| src/components/HrManagement.jsx:94-112 | 管理主資料在載入／手動操作，以及 focus／visibilitychange 時更新；不是持續訂閱會員新增 |
| src/lib/use-auto-refresh.js:26-53 | 10 秒是事件觸發更新的節流時間，不是每 10 秒輪詢；編輯／modal 等狀態會略過 |
| src/app/api/hr/member-request/route.js:25-58 | 登入者選類型／機構並送出後，新增或更新 requested_role，回 201；沒有管理者 LINE 通知呼叫 |
| src/lib/hr-line-bot.js:1283 | LINE「註冊」導向會員網站，不是獨立完成註冊的資料寫入點 |
| src/lib/hr-line-bot.js:1346-1385 | 有 pushLineMessage 與核准後通知申請人的 notifyMemberApproved；兩者不代表已實作新申請通知管理者 |
| server.js:28-33 | 現有 Socket.IO 是銷售 demo 廣播，沒有 HR 管理者私人通知授權通道，不可直接廣播會員資料 |

可解釋的現象：停在管理頁時會員主清單不一定立即更新；提醒區本身沒有新會員待審事件。30 秒輪詢不是新會員通知保證。尚未量測使用者所見的正式站延遲、API／DB 耗時或 LINE 平台投遞時間，不將程式推論冒稱實測根因。

額外風險：聊天室 API 失敗會清空其他提醒，可能把「讀取失敗」誤呈現為「沒有待辦」。這是錯誤處理分支已確認，尚未做真實瀏覽器失敗注入。

## LINE 邊界

- HR Bot 使用既有 LINE_MESSAGING_*；accounting-bot/README.md 明確要求另一個官方帳號與獨立 SQLite，不得混用憑證或把 HR 通知送進記帳 Bot。
- Email 管理權限不等於可投遞的 LINE 身分。接收者需沿用伺服器認定的管理角色與有效 LINE 綁定，並確認與 HR 官方帳號的可投遞關係；不在聊天收集 token 或完整 LINE ID。
- 通知觸發時機、接收者範圍、重複送出／更改申請行為、延遲目標與是否採持久化重試，尚待使用者選定。沒有寫入已批准產品規格或開工計畫。
- 若採 outbox，新增 schema、背景重試程序及真實投遞須分別明確批准與驗證；通知失敗不應回滾已成功送審。

## UI／UX 測試可交付的範圍

可以將「角色→起始狀態→使用者操作→預期結果」變成可重跑案例，分別驗可點擊性、狀態／資料、錯誤訊息、權限、手機版與恢復流程。核心註冊閉環可涵蓋送審、管理者提醒、進入審核、處理結果與申請人看到結果；尚未選定實作方向。

自動化與探索式結果應區分：規格違反／可重現缺陷、業務規則待確認、主觀 UX 建議。無可重現缺陷的建議不自動升為交付阻擋。瀏覽器窄視窗不代表 iPhone／LINE WebView 實機通過；LINE API 成功不代表手機已收到或已讀。

本輪未跑完整產品 E2E、未恢復被刪測試、未更動保護規格或正式設定。通知方案與測試委託方式在對話中討論，待確認後才形成計畫／實作。
