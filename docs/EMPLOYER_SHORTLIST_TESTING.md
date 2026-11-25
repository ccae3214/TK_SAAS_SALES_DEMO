# 雇主左右滑初選：怎麼測試

## 先分清楚兩種環境

目前可直接操作的是 **UI 試用頁**：http://localhost:8091/ 。不需帳號密碼，只有 DEMO 虛構資料；不連 HR 資料庫、登入系統或 LINE，也不會真的推薦、面試或錄用。

它執行本次真正的初選元件與 CSS，能測互動、排版、模擬 API 成功／失敗與重整行為；不是完整登入網站。舊 localhost:8088 的 HR 測試站沒有啟動，不能用這份說明當成其啟動／DB 遷移授權。

## Windows 瀏覽器操作（現在就能測）

【Windows】

1. 用 Edge／Chrome 開啟 http://localhost:8091/ 。先確認頁首是黃色的 UI 測試站說明，畫面上的人名有 DEMO。
2. 按 F12，再按 Ctrl+Shift+M 切換裝置模擬，選約 390px 的手機寬度；這是瀏覽器模擬，不代表已驗實體 iPhone／LINE WebView。
3. 在卡片中央水平往右拖曳，或按「加入待確認」。預期：人選出現在下方待確認；沒有正式送出。
4. 往左拖曳，或按「先略過」。預期：顯示下一位，不加入待確認。
5. 按「復原上一筆」。預期：回到上一位，撤銷那次初選／略過。
6. 按「清單瀏覽」再切回卡片。預期：目前初選仍保留；也可用文字按鈕挑選，不必一定滑動。
7. 加入一位後，勾選頁首「模擬確認失敗」，再到待確認人選按「確認挑選」。預期：顯示失敗訊息，人選仍留在待確認，不被假裝當成成功。
8. 取消勾選，再按「確認挑選」。預期：出現確認提示，人選從本次可選名單及待確認移除。這只是試用頁回應，不寫 DB；快速連按也只應有一次有效送出。
9. 點「Switch request」切換測試需求單。預期：不同需求單不共用尚未送出的初選。
10. 點「English / Reset」確認英文排版，再點「繁體中文／重設」回中文。切換與重新整理會還原 DEMO 人選並清空初選，這不是跨頁持久收藏。

「查看完整履歷」與「下載履歷 PDF」在試用頁只顯示已觸發入口的提示，不提供真實履歷視窗／PDF。正式功能沿用原站，但未在此環境完成登入後驗收。

### 回報問題時

提供網址、瀏覽器、寬度、操作步驟、預期與實際結果；可附 DEMO 畫面截圖。不要貼真實履歷、帳密、Token 或個資。

## Agent 已實際驗證

- 最新整合基底 main `03eaa2d`（保留加入手機桌面的功能）。
- Node 20.20.2＋Python 3.12.16＋ffmpeg：`npm run test:hr` 540 通過／0 失敗／0 跳過。
- 真實元件及 CSS 的 Chromium 檢查：52 項通過／0 失敗；375×812 繁中、390×844 英文、844×390 繁中 reduced-motion、1280×900 英文。這組 API 是受控 fixture。
- 實際 UI 試用伺服器 HTTP／瀏覽器：13 項通過／0 失敗；檢查警示、初選不送出、409／200、去重、重整、需求隔離、履歷／PDF 測試提示、英文、溢出、非預期路由 404、非法請求 400、大請求 413。HTTP 成功結果明確標示 previewOnly。
- WSL 主機存取 http://localhost:8091/ 回 200；容器 `tk-saas-shortlist-ui-preview` 為 healthy，只發布 127.0.0.1:8091，不發布 DB port。
- Docker production build 成功；原設定跳過 lint／型別，不列為通過。GitHub 精確 head CI 另以 PR checks 為準。
- 未執行 Windows 自動化或實體手機驗收；上述 Windows 操作是供使用者複驗的步驟。

## Agent 可重跑命令

下列均在 repository root；需要 Docker Desktop 與已安裝的鎖定 npm 依賴。`<scratch>` 換成外部可寫暫存目錄。由 Agent 執行即可，不需使用者逐行操作。

【WSL】

```bash
docker run --rm -v "$PWD:/work:ro" -w /work node:20-alpine sh -c 'apk add --no-cache python3 ffmpeg >/dev/null && node --version && python3 --version && npm run test:hr'
docker build -t tk-saas-sales-demo-review:employer-shortlist .
docker run --rm --network none --ipc=host -v "$PWD:/work:ro" -v "<scratch>:/scratch" -e TMPDIR=/scratch -w /work mcr.microsoft.com/playwright:v1.65.0-noble node scripts/test-employer-shortlist-ui.mjs
docker compose -f compose.shortlist-preview.yaml up -d --wait
docker run --rm --network container:tk-saas-shortlist-ui-preview --ipc=host -v "$PWD:/work:ro" -v "<scratch>:/scratch" -e TMPDIR=/scratch -w /work mcr.microsoft.com/playwright:v1.65.0-noble node scripts/test-shortlist-preview.http.mjs
```

停止 UI 試用頁，不刪資料庫或 volume：

【WSL】

```bash
docker compose -f compose.shortlist-preview.yaml stop
```

## 完整登入網站測試的前置條件（尚未執行）

要驗證雇主實際確認→PostgreSQL→仲介看到人選→面試／錄用，需要另行明確批准：只操作指定隔離 review DB，先備份與實際還原，再套用目前 main 既有 migration／必要虛構 fixture。不得拿正式 DB 測試或啟用真實 LINE；不因 UI 試用通過而視為已授權。

經批准準備好環境後，才使用真實測試帳號操作；讀回精確需求單、人選與案件狀態，驗證滑動沒有寫入、確認只寫一次、過時資格被伺服器拒絕、仲介看到正確結果。UI 試用頁不能替代這段證據。
