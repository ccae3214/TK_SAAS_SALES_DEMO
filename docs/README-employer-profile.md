# 雇主補充資料／被照顧人／月薪 修改包

依《菲律賓移工來台工作：五方實務指南》補強雇主頁面與工作需求單。基底：`main` @ 52b0d7c。

## 套用方式（專案根目錄）
```bash
unzip -o employer-profile-patch.zip          # 解壓新增檔案與腳本到專案根目錄
node scripts/apply-employer-profile.mjs --check   # 先檢查，不寫入
node scripts/apply-employer-profile.mjs           # 實際套用（5 個既有檔案）
git diff && npm run build
node --test tests/hr-employer-profile.test.mjs    # 規則單元測試（15 項）
```
腳本是「精確文字替換」：任何一處對不上就整批中止、不寫入任何檔案；重複執行會自動略過。支援 CRLF。

## 改了什麼
**雇主資料**（會員工作區「基本資料」＋編輯表單、管理端新增／編輯雇主）
- 電話、地址：改為必填（欄位原本就有）。
- 性別、年齡：所有類型都有；家庭看護／家庭幫傭必填，工廠／其他選填（填負責人）。
- 家庭成員（家庭類必填，或勾「獨居」）：每位成員的關係、年齡、性別、是否同住。
- 工廠：統一編號、負責人姓名（必填）；工廠登記證號、工作地點地址、是否提供宿舍／宿舍地址（選填）。
- 提醒清單會列出尚未補齊的項目。

**工作需求單**
- 工作類型為「家庭看護」「家庭幫傭」時，出現「被照顧人」：與雇主關係、年紀、性別、身體狀況（可複選，選項取自指南的看護訓練重點）＋補充說明。四項必填。
- 所有類型新增「預計月薪（新臺幣，選填）」。
- 需求單卡片、台灣仲介／菲律賓仲介的需求列表、管理端需求單都會顯示。

**英文**：新增 `src/lib/hr-translations-employer.js`，接在既有 `translateHrText` 後面；選項、驗證訊息、提醒組合字串（「待補：…」）都有對照。

## 資料庫
`ensureSchema` 會自動執行（皆為 `ADD COLUMN IF NOT EXISTS`，不動既有資料）：
`hr_employers.employer_profile JSONB`、`hr_job_orders.care_recipient JSONB`、`hr_job_orders.monthly_salary INTEGER`。
**部署到正式 DB 前請先取得授權**（專案文件要求），並先備份。

## 隱私設計（可調整）
- 被照顧人**不收全名與病歷**，只收關係、年紀、性別、狀況。
- 雇主年齡／性別／家庭成員：只給雇主本人、台灣仲介、管理者；**工作者與菲律賓仲介看不到**（後端 GET 已過濾）。菲律賓仲介仍看得到需求單上的被照顧人資訊，因為配工需要。
- 身體狀況屬特種個資，上線前請確認個資告知與同意文字。

## 驗證狀況與限制
- 已執行：規則單元測試 15 項、翻譯覆蓋測試、新元件渲染測試、`HrMemberPortal.jsx` 真實檔案套用＋JSX 語法檢查、CRLF、失敗時整批中止。
- **尚未實跑**：`route.js`、`HrManagement.jsx`、`HrReminders.jsx`、`hr-translations.jsx` 這 4 個檔案我無法放進沙箱，替換點是照 GitHub 上的原文逐字複製，並用替身檔驗證腳本機制。請務必先 `--check`；若有對不上會明確指出是哪一處。
- 未做：`npm run build`、瀏覽器實測、資料庫實跑（沙箱無網路與 DB）。
