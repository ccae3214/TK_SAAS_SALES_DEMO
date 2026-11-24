# 雇主手機初選卡片：設計與自我審查

## 已確認範圍

使用者選 A：右滑加入待確認、左滑先略過，可復原上一筆；最後在待確認人選按「確認挑選」才送出既有選工 API。不是自動安排面試或錄用。此輪只交付本機 feature 分支，未取得本功能 push／PR／合併／部署授權。

初選放在元件記憶體，依需求單及工作類別隔離；離開分頁、重新整理或元件卸載會清空，畫面明確告知。沒有新增資料表、localStorage、sessionStorage、收藏服務、排序或資格規則。

## 設計規範與來源

實際使用 Allen 的 `ui-ux-pro-max` 搜尋：

- `recruitment staffing mobile shortlist --design-system`：得到 Flat Design、專業藍搭綠色操作色、漸進揭露建議。行銷 funnel 版型與 Inter／Playfair 的奢華字體建議不適合現有業務頁，不套用。
- `dragging movements --domain ux`：命中 WCAG 拖曳替代操作；保留完整文字按鈕與方向鍵。
- `Chinese multilingual readable --domain typography`：確認 Traditional Chinese 的 Noto Sans TC 參考；本輪沿用既有 font-family，不額外下載字型或改全站。

依 `frontend-design` 收斂：延續人力服務的深綠識別，沒有交友愛心、外貌分數、炫光或配對灑花。照片為 96×120 的輔助資訊，工作經驗、語言與仲介資料是主要內容；完整履歷與 PDF 沿用既有功能。

局部 tokens：文字 #173c33、次要文字 #52645d、操作 #176347、淺底 #eef6f1、白底 #ffffff、邊線 #c9d8ce。實際計算白底文字對比 12.13／6.29、主按鈕白字 7.21，錯誤文字 #a12222 在白底 7.59。這不是完整 WCAG 認證。

`humanizer-zh` 檢查後採明確動詞：「先略過」「加入待確認」「移出待確認」「確認挑選」，不使用「喜歡／不喜歡」描述工作者。英文介面套用既有職類翻譯；使用者填寫的姓名、經歷不擅自機翻。

## 程式責任

- `src/components/HrEmployerShortlist.jsx`：卡片／清單、手勢／按鈕／鍵盤、復原、暫存初選、逐位確認、失敗保留與重複送出鎖定；只載入目前卡片照片，使用原受保護 endpoint，沒有放寬照片權限。
- `src/components/HrEmployerShortlist.module.css`：局部樣式、44px 以上按鈕、可見焦點、安全區、pan-y／pinch-zoom、reduced-motion、長文字與小螢幕處理。
- `src/lib/hr-employer-shortlist.js`：純手勢判斷、初選投影、去重及結構化／舊版工作經歷顯示。
- `src/components/HrMemberPortal.jsx`：取代雇主原有可選人選清單；保留工作類別、可選名單、已選排除與需求狀態判斷；`selectOrderWorker` 回傳既有送出結果供新元件處理失敗。其他角色、推薦人選、面試與錄用不改。
- `tests/hr-employer-shortlist.test.mjs`：手勢門檻、去重、復原、需求隔離、失效名單、工作經歷及真實 Portal 接線。
- `scripts/test-employer-shortlist-ui.mjs`：實際 React 元件、實際元件 CSS＋Portal CSS 的 Chromium harness；auth／照片／寫入回應為明確虛構 fixture，不是真實 DB／登入 E2E。

## web-design-guidelines 自我審查

依已安裝 skill 的 pinned bundled 規範檢查（不擅自改成網路最新版）：

- `HrEmployerShortlist.jsx`：動作使用 button、有文字名稱，裝飾 Lucide 隱藏於輔助科技；可用按鈕／鍵盤代替滑動，非僅手勢操作。載入目前照片時保留尺寸與無照片替代，舊照片不串到下一位。初選數量 aria-live、錯誤 alert、成功 status。
- `HrEmployerShortlist.module.css`：focus-visible、明確 transition 屬性、reduced-motion、安全區、文字換行與按鈕狀態。最終依手機截圖把「確認挑選」改為獨立全寬按鈕，避免中文被擠成兩行。
- 清單逐批增加 12 位，使用 content-visibility，不一次載入所有照片；保留清單替代入口。
- 瀏覽位置與未送出初選屬目前頁面暫態，不將個資／草稿放入 URL。非跨裝置持久收藏，沒有宣稱網址可還原未送出的初選。
- 全站既有頁面、完整履歷 modal、PDF 生成、其他角色與暗色模式不屬這輪全面改版，未冒稱整站符合規範。

## 驗證與曾發現的問題

整合最新 main 前：Node 20 完整 HR 525 通過／0 失敗／0 跳過，Docker build 成功（既有 lint／型別仍跳過）。Chromium 元件共 52 項檢查通過（375×812 繁中、390×844 英文、844×390 繁中 reduced-motion、1280×900 英文），各組 pageerror=0。最終整合後結果見本文件補充及 VERIFICATION_REPORT。

瀏覽器檢查包括：完整履歷／PDF callback、右拖初選不送出、復原、垂直拖曳不誤選、方向鍵、清單切換保留、409 失敗仍留待確認、重複點擊只送一次、名單失效移除、需求切換隔離、真正 Chromium 觸控左右滑不送出、無水平溢出及可見按鈕尺寸。

保留失敗紀錄：

1. 測試恢復全名單後錯誤期待「已看完」按鈕，實際有重新可用人選；調整 fixture 操作，不移除需求隔離斷言。
2. 接著抓到失效人選重新出現時舊初選復活；產品程式新增可用 ID 變更時的暫存清理，保留回歸。
3. 橫向測試的拖曳座標落在可視範圍之外；先捲到卡片標題再取可視座標，保留真正滑動斷言。

## 可重跑

repository root、有鎖定 npm 依賴；不需要 DB URL 或 provider secrets。`<scratch>` 是可寫的外部暫存目錄。

【WSL】

```bash
docker run --rm -v "$PWD:/work:ro" -w /work node:20-alpine sh -c 'apk add --no-cache python3 ffmpeg >/dev/null && node --version && python3 --version && npm run test:hr'
docker build -t tk-saas-sales-demo-review:employer-shortlist .
docker run --rm --network none --ipc=host -v "$PWD:/work:ro" -v "<scratch>:/scratch" -e TMPDIR=/scratch -w /work mcr.microsoft.com/playwright:v1.65.0-noble node scripts/test-employer-shortlist-ui.mjs
```

## 尚未驗證／放行界線

- 未啟動既有 app／DB，未執行 schema 或正式資料異動，未改 secrets、角色、資格規則或通知策略。
- 實際登入後從完整雇主頁面送出→PostgreSQL→仲介通知→面試／錄用閉環尚未重跑；元件 fixture 不代表真實寫入、PDF 產生或完整履歷視窗已驗。
- iPhone Safari、Android 實機、LINE WebView、螢幕閱讀器、真實弱網與大資料量壓力未驗；Chrome 觸控與 viewport 不等於實機驗收。
- 不承諾初選跨重整或裝置保存；如需持久收藏須另確認產品與資料庫範圍。
- 未 push、未開新 PR、未合併、未部署；前一條操作紀錄 PR #62 已由上游合併，這輪不重複修改。
