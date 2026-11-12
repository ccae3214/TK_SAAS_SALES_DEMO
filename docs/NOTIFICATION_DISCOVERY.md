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
- 使用者本輪已選「A 輕量可靠版」（前景待審更新＋可記錄、去重、失敗重試的 LINE 通知），並確認以送出會員類型申請、進入待審為觸發；收件人要求先釐清既有系統管理權限。接收者精確範圍、重複送出／更改申請行為、時效驗收與執行細節仍待確認；方案選定不等於已批准 schema／正式投遞／部署。
- 若採 outbox，新增 schema、背景重試程序及真實投遞須分別明確批准與驗證；通知失敗不應回滾已成功送審。

## UI／UX 測試可交付的範圍

可以將「角色→起始狀態→使用者操作→預期結果」變成可重跑案例，分別驗可點擊性、狀態／資料、錯誤訊息、權限、手機版與恢復流程。核心註冊閉環可涵蓋送審、管理者提醒、進入審核、處理結果與申請人看到結果；尚未選定實作方向。

自動化與探索式結果應區分：規格違反／可重現缺陷、業務規則待確認、主觀 UX 建議。無可重現缺陷的建議不自動升為交付阻擋。瀏覽器窄視窗不代表 iPhone／LINE WebView 實機通過；LINE API 成功不代表手機已收到或已讀。

本輪未跑完整產品 E2E、未恢復被刪測試、未更動保護規格或正式設定。通知架構與觸發方向已選；收件範圍與流程測試策略仍在討論，尚未形成實作計畫。

## 權限現況補充（809259b，程式盤點而非正式帳號名單）

權限由 role、admin_scope、所屬機構／本人／中心與環境白名單共同決定。來源：src/lib/hr-access.js、src/app/api/hr/route.js、src/app/api/hr/training-center/route.js、src/lib/hr-agency-certification-store.js。

| 類型 | 現有實作／主要範圍 |
| --- | --- |
| 最高管理者 | 使用 HR_ADMIN_LINE_USER_IDS 指定 LINE 身分；具有全站管理，且 isHrRootAdminSession=true，才可建立／指派／管理其他系統管理者 |
| 系統管理者 | 環境 ADMIN_EMAILS／HR_ADMIN_EMAILS 白名單，或啟用會員的 admin_scope=system；後端 getHrPrincipal 回 role=admin。全站業務管理，但不是最高管理者；新增／授予其他人的系統管理權限須最高管理者，其他帳號操作仍需逐 API 核對保護條件 |
| 仲介管理者 | role=agency 且 admin_scope=agency；仍是 agency，不是 admin。可管理所屬機構會員資料／啟用狀態，不能藉此變更會員類型或升為全站管理者；可處理自己機構的互貿認證 |
| 台灣仲介業務 | agency_type=taiwan；所屬雇主、相關案件／需求與台灣端步驟，非全站 |
| 菲律賓仲介 Staff | agency_type=philippines；所屬工人／文件、推薦與菲律賓端步驟，非全站 |
| 雇主 | 本人雇主資料、需求、相關候選／案件；可選工人另受台菲互貿認證限制 |
| 工作者 | 本人履歷、文件與相關案件／結果；非其他工人或全站管理 |
| 訓練中心 | 自己 center_id 的師資／課程／班別／批次；系統管理者可跨中心管理。HR trainingRoster 另提供全域符合文件／訓練條件的基本工人名單，沒有 center_id 分派篩選 |
| 待審／未綁角色 | 沒有核准業務角色，只能走申請／待審流程；已登入不等於可以操作全站 |

重要細節：
- 環境白名單在 getHrPrincipal 中先於 DB active／role 查詢；會員停用不代表能撤銷該環境管理身分。環境變更另需授權，本輪未動。
- 畫面的 system_admin 名稱不應單獨拿來選通知對象；須依實際伺服器角色判定。合法寫入路徑會同步 role/admin_scope，但不能假設任意歷史資料都一致。
- 建議的新會員通知收件規則尚未核准：伺服器認定的全站 admin（含最高），有有效 LINE 身分才進 LINE 管道；仲介管理者、停用的一般 DB 會員不納入。Email-only 管理者仍可有站內通知，但不能憑 Email 推 LINE。
- 訓練中心候訓名單是否也應按分派中心隔離，是待確認業務規則，不在本輪擅自改變。

權限映射探針直接載入目前 hr-access.js，以虛構環境白名單及記憶體 DB 替身執行：11 項通過、0 失敗；沒有呼叫 initializer／實際 DB／真實登入。它只確認來源角色映射，不代表所有 endpoint 或租戶矩陣已通過。

## 流程測試工具查證（未安裝／未建立新測試）

使用者要求減少反覆人工走流程，不只是視覺 UI 評語。可採正式可重跑 E2E 為主、AI 探索／產生案例為輔；業務預期先確認，不能讓 AI 自行改判斷標準。

- Playwright Test：可讓不同 browser contexts 分別扮演申請人、管理者、兩側仲介等，連續跑使用者操作；以 API／DB 檢查持久化結果，而非只截圖。正式 JS/TS @playwright/test 尚未列於專案 package.json；舊版曾用 Python Playwright 驗證，但腳本已被 main 刪除，必須先恢復並依最新互貿／訓練規則調整驗證入口。
- Playwright Test Agents：官方 planner／generator／healer 可輔助探索與產測試；不授權 healer 刪斷言、改預期、skip 測試或更新基準線來掩蓋缺陷。官方文件列特定 agent 工具初始化方式，不代表已驗證 Hermes 直接相容。
- Microsoft playwright-cli：提供官方 SKILL.md，涵蓋瀏覽器操作、測試生成、trace 等；可參考或之後評估整合。本輪只是查證，沒有下載執行其指令或安裝 skill。
- @axe-core/playwright：補標籤、對比與可及性問題，不是業務流程引擎，也不能證明整體 UX 良好。
- Trace Viewer：保存操作／網路與頁面狀態方便重現；trace 可能含 session、表單與回應，僅用虛構資料並保護產物，不公開真實憑證。

官方參考：
- https://playwright.dev/docs/test-agents
- https://github.com/microsoft/playwright-cli
- https://playwright.dev/docs/api-testing
- https://playwright.dev/docs/trace-viewer
- https://playwright.dev/docs/accessibility-testing

仍在討論的委託模式：固定腳本回歸（穩定但需維護）、AI探索＋固定回歸混合（建議）、純AI巡測（彈性但不宜單獨當放行門檻）。候選流程為會員送審／通知／核准、互貿認證／推薦／面試／錄用、文件退件／補件／再審；不是這些新測試已存在或已通過。使用者不需每輪重新手測全部案例，但仍須先確認關鍵業務預期，真實 LINE 接收／實機與正式放行另列驗收界線。
