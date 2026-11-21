# 資料庫備份與還原 / Database backup & restore

## 先看這裡 / Start here

- **誤刪會員帳號：** 到「會員帳號」頁最下方的「已刪除帳號」，按「還原」即可，不需要備份檔。
  **Deleted a member by mistake:** open *Member Accounts* → *Deleted accounts* and press *Restore*. No backup file needed.
- **其他資料不見、或資料庫壞掉：** 用下面的備份檔還原。
  **Anything else lost, or a broken database:** restore from a backup file as described below.

## 備份 / Back up

在專案資料夾執行（需要 Docker Desktop 已啟動）：
Run in the project folder (Docker Desktop must be running):

```powershell
npm run db:backup
```

- 備份檔存在 `backups\`，檔名像 `saas_demo_20261116-030000.dump`。
  Files go to `backups\`, named like `saas_demo_20261116-030000.dump`.
- 預設保留最新 14 份，可用 `npm run db:backup -- --keep 30` 調整；也可以用 `--out D:\backup` 改存到別的硬碟。
  The newest 14 are kept by default; change it with `--keep 30`, or store elsewhere with `--out D:\backup`.
- 備份完成後會自動驗證檔案能讀取；失敗時不會留下半成品，也不會刪掉舊備份。
  Each backup is verified after it is written. On failure no partial file is left and old backups are not pruned.

### 每天自動備份（Windows）/ Daily automatic backup (Windows)

用系統管理員身分開啟 PowerShell，執行一次即可（每天凌晨 3:00）：
Run once in an administrator PowerShell (every day at 03:00):

```powershell
schtasks /Create /SC DAILY /ST 03:00 /TN "TK_SAAS_DB_Backup" /TR "cmd /c cd /d C:\Users\ccae3\Documents\GitHub\TK_SAAS_SALES_DEMO && if not exist backups mkdir backups && npm run db:backup >> backups\backup.log 2>&1"
```

查看是否有成功：打開 `backups\backup.log`，或確認 `backups\` 裡有今天的檔案。
To check it worked, open `backups\backup.log` or look for today's file in `backups\`.

> **請定期把 `backups\` 複製到另一顆硬碟或雲端。** 備份和資料庫放在同一台電腦，電腦壞掉時兩者會一起消失。
> **Copy `backups\` to another drive or cloud storage regularly.** If backups live on the same computer as the database, a disk failure takes both.

## 還原 / Restore

還原**不會**覆蓋正式資料庫，而是還原到一個暫時資料庫，讓你查看並找回需要的資料：
Restoring never overwrites the live database. It restores into a temporary database so you can inspect it and recover what you need:

```powershell
npm run db:restore -- backups\saas_demo_20261116-030000.dump
docker compose exec postgres psql -U postgres -d restore_tmp
```

例：找出被刪的會員 / Example — find a deleted member:

```sql
SELECT id, email, line_user_id, display_name, role, worker_id, employer_id, agency_id
FROM hr_members WHERE display_name ILIKE '%名字%';
```

用完後刪除暫時資料庫 / Drop the temporary database when done:

```powershell
docker compose exec postgres psql -U postgres -d postgres -c "DROP DATABASE restore_tmp"
```

## 很重要：加密金鑰 / Important: the encryption key

上傳的文件在資料庫裡是加密的。**請另外保管 `.env` 裡的 `HR_DOCUMENT_ENCRYPTION_KEY`**（不要放進備份資料夾或 GitHub）。
遺失這把金鑰，即使備份還在，文件也無法解開。
Uploaded documents are encrypted in the database. **Keep `HR_DOCUMENT_ENCRYPTION_KEY` from `.env` somewhere safe and separate** (not in the backup folder or on GitHub). Without it the documents cannot be decrypted, even if the backup is intact.

備份檔含有個資與加密後的文件，已加入 `.gitignore` 與 `.dockerignore`，不會被提交或打包進映像檔。
Backups contain personal data and encrypted documents; `backups/` is excluded from git and Docker images.
