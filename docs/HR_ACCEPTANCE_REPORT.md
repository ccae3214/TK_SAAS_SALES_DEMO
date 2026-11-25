# 後台驗收報告｜實作者自我驗證，不是獨立核准

## 結論

完整驗收未通過。40 筆案例最終為 29 通過、9 失敗、2 受阻；9 個失敗案例涉及 5 類已重現的流程缺陷，不等於 9 個彼此獨立的產品問題。不能用既有單元全綠或 Docker build 成功代替業務驗收。

本輪只交付測試工具、案例、證據與缺陷定位。未修改產品程式、既定權限或 schema 定義，未修復下列缺陷；只適合 Draft 審查，不應以此合併或部署。基底 main `69871560d89af96d60e48b0f6087d46cca3f7887`，後續 main 更新不自動繼承本輪結果。

發佈前再次 fetch，upstream main 已前進到 `5a901b0`（雇主需求列表進度篩選）。本輪沒有在發佈時混入該更新，因此這份實證只涵蓋上述凍結基底；新增篩選功能未驗，不能宣稱已覆蓋發佈當下所有 main 更新。

- 案例主表：[HR_ACCEPTANCE_CASES.csv](HR_ACCEPTANCE_CASES.csv)
- 操作閱讀版：[HR_ACCEPTANCE_CASES.md](HR_ACCEPTANCE_CASES.md)
- 精確時間、逐筆斷言、歷輪結果：[hr-acceptance-results.json](review/hr-acceptance-results.json)，最終 run `5b3d38b6`。
- 畫面證據：[仲介錯誤邊界](review/hr-acceptance-render-error.png)、[雇主建立需求](review/hr-acceptance-demand-created.png)。前者為原截圖上方裁切，沒有重繪。

## 已確認的缺陷與可重現步驟

### F1｜交接訊息存在時，仲介頁面可能整頁崩潰

案例：FLOW-02、START-02、LANG-01、LANG-03、LANG-05。

1. 雇主建立需求，管理者指派菲律賓仲介，系統產生三方交接訊息。
2. 所屬仲介重新載入工作區，或重新讀取相關訊息。
3. 真實 Chromium 出現 `Application Error`／`ReferenceError: localeFor is not defined`；工作操作／語言切換無法繼續。

定位：`src/components/HrChat.jsx:102` 使用 `localeFor`，檔案未匯入該符號。`HrMemberPortal.jsx` 即使不在聊天室分頁仍掛載隱藏的 HrChat，因此不是只有主動開聊天室才有風險。錯誤由 React 邊界捕獲，Playwright pageerror 事件數為 0 仍會有真實錯誤畫面；本輪有讀取 DOM 錯誤與截圖佐證。

替代／修復方向：補正實際匯入，保留「已有系統訊息」的回歸 fixture，不能只在空聊天室驗證。這是已重現缺陷，不是另提聊天室新功能。

### F2｜已取消需求仍能被舊操作錄用並建案

案例：FLOW-10。

1. 對 open 需求推薦一位工人，保留雇主已取得的 candidate ID。
2. 管理者透過既有 API 將需求改為 cancelled。
3. 雇主對舊 candidate 送出 `job-order-candidate-interview`／`passed`。
4. 預期拒絕且無新案；實際 HTTP 200、candidate 變 passed，新增正式案件。

定位：`src/app/api/hr/route.js:388-420`。錄用交易有需求人數與工人鎖定，但取回候選時沒有以需求終止狀態阻擋這條舊操作。JSON 保留 before/after 案件 ID 與真實回應。

修復方向：在既有鎖定交易內重新檢查需求狀態，並保留取消後舊請求的 HTTP／DB 回歸；不只隱藏按鈕。

### F3｜工作者層級 OEC／簽證進度無法儲存

案例：DOC-06。

1. 已錄用案件，所屬菲律賓仲介對 `/api/hr/agency-workers/<workerId>` PATCH `type=step`、`stepKey=oec`，帶有效開始／完成日。
2. 預期 200 且工人與案件同步；實際 500，安全 log 為 `hr_worker_progress_update_failed 08P01`。

定位：`src/app/api/hr/agency-workers/[id]/route.js:199-203`，INSERT 欄位未包含 detail，SQL 只到 `$6`，但參數陣列包含第七個 detail 值；ON CONFLICT 又讀 EXCLUDED.detail。這是參數／欄位對不上的協定錯誤。隔離 DB 唯讀讀回當時 OEC progress row 為 0，不能把失敗顯示當成已存成功。簽證與後續抵台步驟在同一案例內保留完整斷言，但在首個 OEC 寫入失敗處中止，沒有冒稱後續通過。

修復方向：對齊欄位、占位符與值，驗證工人與案件同步、交易失敗回滾。

### F4｜訓練報名回 500，但資料已寫入

案例：DOC-05。

1. 初審三取二通過，訓練中心依序建立證照、課程、班別。
2. POST `/api/hr/training-center`，`resource=enrollment`，選擇合法 classId／workerId。
3. 實際 500，log `hr_training_center_write_failed ReferenceError`。
4. 另以唯讀 SQL 確認 `ACCEPTANCE class 5b3d38b6` 已有 1 筆 enrollment；失敗回應與持久資料不一致。

定位：`src/app/api/hr/training-center/route.js:265-288`。enrollment 分支在呼叫 `record(...)` 前，已 INSERT；同一 try 區塊稍後的 `const record` 遮蔽模組函式，前面分支落在 temporal dead zone。這不是「未填資料」或單純測試定位問題。

修復方向：解除變數遮蔽，明確處理寫入與紀錄錯誤邊界，再驗證成功／重送與三方讀回，避免把部分成功一律包裝成失敗。

### F5｜Filipino 選項文字滲入資料值

案例：LANG-06。

1. 真實雇主頁切為 FIL，使用者選擇工廠技術工選項。
2. 控制注入一次 HTTP 500 驗證草稿保留，之後解除攔截，讓重試走真實 app／DB。
3. 真實重試回 201，但 DB 的 job_type 為 `Technician sa pabrika`，不是既有流程的 `工廠技術工`。
4. 執行器因此失敗，未把「有送出成功」當成語言驗收通過。

定位：`src/components/HrMemberPortal.jsx:1075` 的 option 沒有明確 value，翻譯文字變成瀏覽器選項值；系統其他職類比對仍使用原本固定值。可由 DB 精確比較確認，不必要求 wei 看懂 Filipino。

修復方向：將固定 machine value 與顯示文字分離，保留中／英／FIL 真實選擇、送出與 DB 值的回歸。不能放寬成接受任意翻譯後職類來讓測試通過。

### 附帶可重現的畫面問題（不混入上述失敗數）

雇主「編輯需求」表單部分 HTML numeric entity 缺分號，工作內容及指定業務標籤出現 entity 殘字，職類選項也有顯示異常。來源同檔的編輯表單 JSX。START-08 最後用同一表單的 textarea 操作，實際完成草稿／focus／儲存檢查，沒有因標籤定位失敗就假稱草稿會遺失；這個文字問題獨立列出，未為了讓測試過而改產品。

## 已確認通過的主要行為

- 四種會員角色的真實 credential UI 登入、基本起點及刷新。
- 雇主真實 UI 建需求、面試、錄用，並從三方授權 API／DB 讀回同一識別與正式案件。
- 同會員 A/B/C 並行事務的 API 不串單、兩個獨立雇主 session 同時搶最後名額，實際 200／409 且只錄用一人；這不代表被 F1 阻擋的仲介完整 UI 已通過。
- 同推薦並行重送去重、撤回保留本人／文件／其他推薦、已面試及已錄用拒絕撤回。
- 控制 500 後草稿保留、真正重試只建立一筆，focus 更新不覆蓋編輯草稿。
- 初審護照／PSA／LCR 三取二、文件退回原因／補傳版本、工作者共用文件、手動適用性不被自動覆寫。
- 真實 PDF 上傳／解密下載逐 byte 比對，偽 PDF 415、跨機構附件拒絕。
- 所屬／非所屬、匿名／待審、跨本人 ID、切換身分及 session 失效後的伺服器拒絕。
- 語言切換時已測金額、日期、識別與原文不變；未知語言／缺翻譯沿用既定 fallback。不能由此推論 FIL 送出流程或母語語意全部正確。

## 環境與實際執行

全新 `tk-hr-acceptance` Compose 專案，PostgreSQL 16，volume `tk_hr_acceptance_data`。app／DB 只有 internal network；另用固定 upstream 的本機 HTTP viewer 提供瀏覽器入口，不提供任意代理、不轉送通話 WebSocket。

【Windows】瀏覽器：http://localhost:8092/hr/login 。站內保留虛構測試資料與缺陷，不是正式站。帳號 email／ID 在本機忽略的 `test-results/acceptance/fixtures.json`，密碼只在該驗收工作目錄 `.env.acceptance.local` 的 `ACCEPTANCE_LOGIN_PASSWORD`；不貼聊天／Git。

應用 image：`sha256:81666d6bee7638aa80fe41d69ebfa0a049486c095a49e0f7adfe7ce9d8a697ca`。app／完整單元為 Node v20.20.2；Playwright v1.65.0 映像內 runner 是 Node v26.13.1，不混稱為 Node 20 瀏覽器 runner。

以下命令在 repository／驗收 worktree 根目錄執行。重跑前保持本輪批准的隔離環境範圍；不得改連正式 DB。

【WSL】首次才產生本機測試密鑰（既有檔案會拒絕覆寫；這個產生／拒絕／0600 行為已另實跑 3 項檢查通過）：

```sh
docker run --rm --network none -v "$PWD:/work" -w /work node:20-alpine node scripts/prepare-hr-acceptance.mjs
```

【WSL】本輪已實跑的安裝、build、啟動與基線命令：

```sh
docker run --rm -v "$PWD:/work" -w /work node:20-alpine npm ci
docker compose --env-file .env.acceptance.local -f compose.acceptance.yaml build app
docker compose --env-file .env.acceptance.local -f compose.acceptance.yaml up -d app viewer
docker run --rm -v "$PWD:/work:ro" -w /work node:20-alpine sh -c 'apk add --no-cache python3 unzip ffmpeg >/dev/null && node --version && npm run test:hr'
```

結果：安裝成功；Docker build 成功，lint／型別依原設定跳過，不算通過；完整既有 HR 575 通過／0 失敗／0 跳過。`npm ci` 當次回報 9 項依賴警告（7 moderate／2 high），未擅自升級；不是新的 production-only audit 結果。完整回歸保留 repository 原有純邏輯通知測試，不是本輪另做推播整合驗收。

【WSL】第一次空 DB 執行：

```sh
docker compose --env-file .env.acceptance.local -f compose.acceptance.yaml run --rm --no-deps test node scripts/acceptance-bootstrap.mjs
docker compose --env-file .env.acceptance.local -f compose.acceptance.yaml run --rm --no-deps test node scripts/test-hr-acceptance.mjs
```

【WSL】同一隔離 DB 重跑時只追加新 cohort，不 reset／delete：

```sh
docker compose --env-file .env.acceptance.local -f compose.acceptance.yaml run --rm --no-deps test node scripts/acceptance-bootstrap.mjs --new-cohort
docker compose --env-file .env.acceptance.local -f compose.acceptance.yaml run --rm --no-deps test node scripts/test-hr-acceptance.mjs
```

最終真實案例命令 exit 1：29 通過／9 失敗／2 受阻，未用 skip 或改預期掩蓋。原始截圖與細節留在忽略的 test-results；公開檔只收虛構資料、脫敏結果及選定畫面。

【WSL】實際站點 smoke：

```sh
curl --max-time 15 -s -o /dev/null -w 'login HTTP=%{http_code}\n' http://localhost:8092/hr/login
curl --max-time 15 -s -o /dev/null -w 'anonymous hr HTTP=%{http_code}\n' http://localhost:8092/api/hr
git diff --check
```

登入 200、匿名 API 401；這只是入口／匿名保護，不抵銷上方業務失敗。

## 中途失敗、案例修正與未驗限制

- 初輪有測試定位與 fixture 問題：新手導覽晚掛載、已核准的會員被誤拿來做待審安全檢查、空機構被另一情境加入需求、已分派需求卻要求可編輯。已改成實際 UI 略過導覽並讀回 seen、獨立待審安全 fixture／空機構、尚未分派的編輯需求，再以新 cohort 完整重跑。
- 一輪 waiter 錯誤造成提早中止，沒有把該輪當成 40 筆完整結果。各輪完整性與實際計數保留在公開 JSON；最終只引用 run `5b3d38b6`。
- 最初案例與舊分支不符的前置規則已依最新 main 校正：文件是三取二，撤回不是新增原因表單。未修改既定產品規則，未刪／弱化原有測試。
- LANG-02／LANG-08 缺獨立 Filipino 校對者／新手使用者，屬受阻，不是通過。LANG-05 實體手機、iPhone／LINE WebView 尚未驗，不能由 390px Chromium 代替。
- 真實 LINE／Google／推播／通話、正式資料與正式備份還原均未驗。只有新隔離 DB 初始化獲准；既有 DB、schema 定義、認證／權限及 production 未變。
- 本輪建立的 runner 不會取代既有 CI，也未擅自增刪 CI gate。現有 CI 綠燈最多證明其單元與 build；真實驗收失敗仍然存在。
- 下一步是另行修復上述已重現產品缺陷，保留相同預期重跑 40 筆，再補獨立語言／實機驗收；不是把失敗案例標成正常後送出。
