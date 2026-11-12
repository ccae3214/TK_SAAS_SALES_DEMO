# 台灣／菲律賓仲介相互認證

規則：同一組（台灣仲介 A、菲律賓仲介 B）必須**雙方都確認**，才算認證完成。
未認證時：A 的雇主看不到 B 的工人、不能挑選；B 不能向 A 的需求單推薦人選；雙方不能安排面試／錄用／建案。

## 流程
1. 任一方的**仲介管理者**在「需求與配對」分頁按「申請認證」→ 狀態「等待對方確認」。
2. 對方仲介管理者「同意」→ 兩邊都有確認時間，狀態 `certified`；或「拒絕」。
3. 任一方可隨時「解除認證」（或撤回自己尚未被確認的申請）；被拒絕／解除後可重新申請。
4. 系統管理者可在「仲介機構」分頁看全部紀錄、直接認證、代為同意／拒絕、解除（寫入系統管理員操作紀錄）。
5. 雇主在「需求與配對」分頁唯讀看到「可挑選的菲律賓仲介」。

## 資料與關卡
- 資料表 `hr_agency_certifications`（每組一筆，UNIQUE）；資料庫 CHECK：`certified` 必須兩邊確認時間都有值。
- 導入時，已有案件或媒合路線的組合自動標為 `grandfathered` 已認證，避免進行中的案件中斷；之後被解除的不會被重新打開。
- 後端關卡（`src/app/api/hr/route.js`）：雇主可挑選名單、雇主挑選工人、菲律賓仲介推薦、管理者指派菲律賓仲介、面試排程／錄用、管理者建案。
- 解除認證**不會刪除**既有推薦、案件；但之後不能再安排面試或錄用。拒絕人選（rejected）不受限。
- 新 API：`GET/POST /api/hr/agency-certifications`（action：request／approve／reject／revoke／certify）。

## 套用
解壓到專案根目錄後執行 `node scripts/apply-agency-certification-wiring.mjs --check`，再不加 `--check` 執行。
腳本只在每個錨點都剛好出現一次時才寫檔，可重複執行。測試：`node --test tests/hr-agency-certification.test.mjs`。
