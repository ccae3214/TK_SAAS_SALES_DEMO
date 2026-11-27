# 資料庫結構與檔案儲存 / Database schema & file storage

HR 系統的 PostgreSQL 資料庫（`kolecion_db`）目前的結構重點：檔案怎麼存、資料表怎麼變更、操作紀錄記什麼、哪些舊表被封存。
最後更新：2026-11-28（PR #103、#105、#106 合併後）。

> 想看完整欄位定義：`docker compose exec postgres pg_dump -U postgres -d kolecion_db --schema-only`。
> 平常沒有資料庫管理畫面；資料庫只開在本機 `127.0.0.1:5433`，可以用 DBeaver、TablePlus 等工具連線（帳密在 `.env`）。

## 資料表變更怎麼套用 / How schema changes are applied

- **不需要手動執行 SQL。** app 啟動時會依序執行 `src/lib/hr-migrations.js` 的 `MIGRATION_STEPS`（`CREATE … IF NOT EXISTS`、`ALTER … ADD COLUMN IF NOT EXISTS`、資料搬移），每一步都可以重複執行。
- 合併到 `main` → `.github/workflows/deploy.yml` 在本機的 self-hosted runner 重建並重啟 app → 啟動時自動套用。
- **部署流程沒有備份步驟。** 會改到資料表的 PR，合併前請先跑 `npm run db:backup`（見 [BACKUP.md](BACKUP.md)）。
- 新增的遷移函式要命名為 `ensure*Schema` 並登記到 `MIGRATION_STEPS`；`src/app` 的請求路徑不可以自己寫 `CREATE`／`ALTER`（`tests/hr-migrations.test.mjs` 會檢查）。
- 目前沒有版本號式的遷移檔，也沒有自動回滾；要回復請用備份（見下方「回復方式」）。

## 檔案儲存 / File storage

所有上傳的檔案都存在 PostgreSQL 的 `bytea` 欄位，用 `HR_DOCUMENT_ENCRYPTION_KEY` 做 **AES-256-GCM** 加密（每個檔案各自隨機 IV，另存驗證標籤與明文的 SHA-256，下載時驗證完整性）。

| 資料表 | 內容 | 允許格式 | 上限 |
|---|---|---|---|
| `hr_document_files` | 工作者文件（每次上傳一個版本，對應 `hr_document_submissions`） | PDF、JPG、PNG（看檔案內容判斷，不信任副檔名） | 10 MB |
| `hr_employer_documents` | 雇主文件（核准函） | PDF、JPG、PNG | 10 MB |
| `hr_agency_certificates` | 仲介證書 | PDF、JPG、PNG | 10 MB |
| `hr_worker_photos` | 履歷照片（每位工作者一張，PR #103 起） | JPG、PNG | 約 1.5 MB（裁切後） |

- **履歷照片（PR #103）**：以前是明文 base64 放在 `hr_workers.resume_profile.photoDataUrl`。現在加密存到 `hr_worker_photos`（存原始位元組、記錄 `key_version`）；API 仍收送 `photoDataUrl`，前端不受影響。正式機原有 23 張已在 2026-11-28 搬移完成，`resume_profile` 裡不再有照片。沒設定金鑰的環境（本機開發）仍存在 JSONB。
- **打包下載 ZIP（PR #103）**：`/api/hr/workers/[id]/documents-zip` 改用 `createZipStream`（`src/lib/zip-store.js`），一次只解密一份文件就送出，記憶體用量約等於一份文件；第一份先驗證，金鑰錯誤時回 500。
- **金鑰**：遺失金鑰，所有文件與照片都無法解開；金鑰外洩，所有檔案都會曝光。請另外保管，不要放進備份資料夾或 GitHub。目前所有檔案共用一把金鑰（`key_version` 欄位目前只在 `hr_worker_photos` 有，供日後換金鑰使用）。

## 操作紀錄的改前／改後資料 / Audit before/after (PR #105)

- `hr_admin_audit_log`、`hr_agency_audit_log` 有 `before_data`、`after_data`（JSONB，可為空）。
- 透過網頁 `/api/hr` 對工作者、雇主、仲介、會員帳號、案件的新增、編輯、刪除、變更類型，都會在操作前後拍快照（`src/lib/hr-audit-snapshot.js`），只存**有變動的欄位**；履歷、雇主補充資料等 JSONB 欄位再往下比一層。刪除存完整的改前資料，新增存完整的改後資料。
- 不記錄密碼、LINE ID、履歷照片、時間戳記；過長的文字會截斷，單筆約 30 KB 以內。
- 後台「操作紀錄」每一筆可展開「查看變更內容」（`src/components/HrAuditChanges.jsx`）。
- 2026-11-28 之前的舊紀錄沒有前後資料（兩欄為 NULL）。
- 尚未涵蓋：LINE 機器人上的管理操作、訓練中心操作紀錄（`hr_tc_audit_log`）。

## 文件種類代碼 / Document type keys (PR #106)

- `hr_document_types`：25 種工作者文件的固定代碼（例如 `passport_new`、`psa_birth`、`nbi_clearance`），內容由 `src/lib/hr-requirements.js` 的 `WORKER_DOCUMENT_KEYS` 維護，啟動時同步。**代碼上線後不要再改。**
- `hr_worker_documents.type_key`：指向 `hr_document_types.key`。新增或改名時由資料庫 trigger（`hr_worker_documents_type_key`）自動帶入；管理者自訂的額外文件不在對照表裡，維持 NULL。
- 程式目前仍以顯示名稱 `hr_worker_documents.name` 判斷文件種類；`type_key` 是為了以後改文件名稱時資料不會對不上。

## 約束與索引 / Constraints & indexes (PR #106)

狀態欄位的 CHECK（允許的值與程式的定義一致）：

| 約束 | 允許的值 |
|---|---|
| `hr_employers_employer_type_check` | `home_care`、`factory`、`domestic_helper`、`nursing_home`、`other` |
| `hr_worker_documents_applicability_source_check` | `auto`、`manual` |
| `hr_cases_medical_status_check`、`hr_worker_health_training_medical_status_check` | `MEDICAL_STATUSES`（`src/lib/hr-worker-progress.js`） |
| `hr_cases_training_status_check`、`hr_worker_health_training_training_status_check` | `TRAINING_STATUSES`（同上） |

- **新增狀態值時**：要同時改程式的清單與這裡的約束（`src/lib/hr-schema-normalize.js` 的 `STATUS_CHECKS`），否則寫入會被資料庫擋下。
- 外鍵欄位都已有索引（命名為 `<表>_<欄位>_idx`，清單在 `FOREIGN_KEY_INDEXES`）。
- `hr_worker_documents` 的主鍵、約束、序列名稱已改為 `hr_worker_documents_*`（這張表原本叫 `hr_case_requirements`）。

## 封存的舊表 / Archived tables (`hr_archive`)

PR #106 把確認不再使用的表移到 `hr_archive` schema。**資料沒有刪除**，備份與還原也會一起包含。

| 表 | 原因 | 筆數 |
|---|---|---|
| `hr_archive.hr_case_requirements` | 文件改為工作者層（`hr_worker_documents`）後留下的空表 | 0 |
| `hr_archive.hr_staff` | 舊的承辦人表，已由 `hr_cases.assigned_member_id` 取代 | 1（測試承辦人） |
| `hr_archive.schema_migrations` | 別的專案留下的紀錄，這個專案沒有用到 | 2 |

- `hr_cases.assigned_staff_id` 已移除（移除時全部為 NULL）。
- 要搬回：`ALTER TABLE hr_archive.<表> SET SCHEMA public;`
- 封存後觀察一段時間確定沒有需要，再決定是否真的刪除；刪除前請先備份。

## 回復方式 / Rolling back

1. 用合併前的備份還原到暫時資料庫查看（[BACKUP.md](BACKUP.md)「還原」），找回需要的資料。
2. 2026-11-28 的關鍵備份：
   - `backups/kolecion_db_20261128-045632.dump`：PR #103、#105、#106 之前。
   - `backups/kolecion_db_20261128-055651.dump`：照片已加密搬移、PR #106 之前。
3. 程式回退時，PR #103 搬走的照片不會自動回到 JSONB；舊版程式讀不到加密表裡的照片，需要從上面的備份取回。

## 尚未處理 / Not done yet

- 體檢／訓練狀態同時存在 `hr_cases` 與 `hr_worker_health_training`；申請進度同時存在 `hr_application_steps`（案件）與 `hr_worker_progress_steps`（工作者）。要先決定以哪一份為準。
- 訓練中心直接用 `hr_members` 的一列代表（`hr_tc_*`、`hr_chat_rooms.center_id` 都指向會員），一個中心要有多位員工時需要拆成獨立的資料表。
- 測試資料與真實資料在同一個資料庫，沒有標記；上線前需要另開測試環境或加 `is_test` 標記。
- 文件與照片存在資料庫裡，資料量變大（約上千位工作者）時再考慮搬到物件儲存（S3、R2、MinIO）。
