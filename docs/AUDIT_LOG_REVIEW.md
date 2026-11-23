# 仲介／訓練中心紀錄整合：自我審查與驗證

## 範圍與目前候選

基底 main `02b4a48`，分支 `fix/unified-organization-audit`。使用者批准修正並開 PR，不含合併 main 或部署。

採 A：既有訓練中心帳號就是該中心管理者，不引入同中心多人分權。保留原機構端 API：仲介管理者只能看自己機構，訓練中心只能看自己的紀錄。全站管理員透過新增的獨立唯讀 API 查看所有機構；不把原機構 API 放寬。

## 功能與檔案

- `src/components/HrManagement.jsx`：在系統管理員「操作紀錄」頁保留原管理員／案件紀錄，加入機構紀錄面板。
- `src/components/HrOrganizationAuditLog.jsx`：仲介／訓練中心來源切換、機構／人員／內容搜尋、100 筆游標分頁、台灣時間、中英文、載入／空結果／錯誤及重試。切換來源不混合前一來源結果。
- `src/app/api/hr/organization-audit/route.js`、`src/lib/hr-organization-audit.js`：實際登入身分 `role=admin` 才能查看；匿名 401、其餘角色 403；來源白名單、參數綁定、BIGINT 游標以字串保存、回應禁止快取，不提供寫入方法。
- `src/lib/hr-migrations.js`：補登記既有 `ensureTrainingCenterAuditSchema`，未修改既有 DDL，也沒有新表／欄位或資料回填。
- `tests/hr-organization-audit.test.mjs`：新 handler 的權限、輸入、SQL 接線、分頁與安全錯誤測試；保留既有機構查看規則。
- `scripts/test-organization-audit-ui.mjs`：獨立 Chromium 元件測試，使用明確虛構的受控 HTTP 回應；不是 DB／完整登入 E2E。CSS 以空 module 替代，不能當成正式版面與手機無溢出的證據。

## 實際驗證

1. Node 20 專項：27 通過、0 失敗、0 跳過（新測試加既有仲介與遷移守門）。
2. Node 20.20.2／Python 3.12.16／ffmpeg：完整 `npm run test:hr`，459 通過、0 失敗、0 跳過。
3. Docker build：`tk-saas-sales-demo-review:organization-audit` 成功，Next.js 15.5.29。既有設定跳過 lint／型別；不能列為通過。安裝回報 9 項依賴警告（7 moderate、2 high），沒有自動升級或修復；不是本輪獨立 production audit。
4. Chromium 元件測試（Playwright image 的 Node 26.13.1）：1280px／390px × 中／英文，各檢查分頁、來源切換、搜尋空結果、錯誤、恢復，共 20 項檢查通過、0 失敗，各組 pageerror=0。
5. `git diff --check` 通過。遠端 CI 以精確 PR head 讀回為準。

保留失敗紀錄：完整測試最初 458 通過／1 失敗，原因為最新 main 的影音測試需要 ffprobe；只補測試容器工具，完整重跑全通過。元件 harness 最初 SWC 行程退出 135，未確認根因；改用 Next 既有 Babel 編譯後發現 runtime alias 缺漏，補齊 harness alias 後四組全通過，未改產品或降低斷言。

## 可重跑指令

以下從 repository root 執行，不需登入／DB secrets。工具安裝需網路，測試本身不設定 DATABASE_URL。

【WSL】完整回歸與 Docker build：

```bash
docker run --rm -v "$PWD:/work:ro" -w /work node:20-alpine sh -c 'apk add --no-cache python3 ffmpeg >/dev/null && node --version && python3 --version && npm run test:hr'
docker build -t tk-saas-sales-demo-review:organization-audit .
```

元件瀏覽器測試需要 repository 的鎖定 npm 依賴（`npm ci`）及主機外部可寫 scratch 目錄。`<scratch>` 改為自己的外部目錄，不可使用正式資料目錄。

【WSL】受控元件測試：

```bash
docker run --rm --network none --ipc=host -v "$PWD:/work:ro" -v "<scratch>:/scratch" -e TMPDIR=/scratch -w /work mcr.microsoft.com/playwright:v1.65.0-noble node scripts/test-organization-audit-ui.mjs
```

## 合併後人工驗收流程（尚未執行）

前提：有明確授權的驗收 DB、既有紀錄及各角色帳號；啟動前確認備份與既有遷移。此 PR 不授權操作正式 DB。

1. 全站管理員：操作紀錄 → 仲介機構，搜尋已知機構／人員，確認與原機構頁內容一致；超過 100 筆可載入更多。
2. 同頁切換訓練中心，確認有中心名稱、操作者與操作內容；切換不殘留仲介紀錄。
3. 仲介管理者：仍只能從自己的工作區查看該機構紀錄；一般仲介成員無入口。直接呼叫統一 API 應 403。
4. 訓練中心帳號：自己的紀錄可看，改其他 centerId 應 403；直接呼叫統一 API 應 403。
5. 匿名呼叫統一 API 應 401；工作者／雇主應 403。

## 限制與放行界線

- 本輪未啟動 app／既有 DB，未對任何既有或正式 DB 執行 schema、fixture 或資料異動。真實 SQL 執行、實際 session／HTTP 跨機構矩陣與完整登入 E2E 尚未驗證；handler 測試的 auth／query 為注入替身，不冒稱真實 DB 測試。
- 未驗正式 CSS、iPhone／LINE WebView、真實 LINE／Google 或全站安全稽核。
- 原有紀錄仍是 best-effort：寫入失敗不阻擋業務操作，沒有新增共同交易、補登舊紀錄或宣稱保證不漏記。
- 新統一入口僅供全站管理員；機構紀錄仍依來源分頁，不是把所有來源依時間混成同一條資料流。
- Production 未部署。合併 main 可能自動觸發既有 Deploy workflow，須由使用者決定，不能把 PR／CI 通過視為部署批准。
