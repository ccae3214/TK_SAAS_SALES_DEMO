# 整合至 TK SaaS 網站

這些新增檔案將筆記功能整合到原本的 Next.js 網站 `/notes`，共用 NextAuth 登入、既有 PostgreSQL 和同一個網域。

## 整合內容

- 新增 `/notes` 響應式筆記工作區，並在首頁導覽加入入口。
- 筆記與資料夾 API 使用 NextAuth 登入身分隔離資料，寫入操作使用既有 CSRF 檢查。
- 新增 PostgreSQL schema，筆記包含 Markdown 內容、標籤、資料夾、釘選及封存欄位。
- 使用現有 PWA manifest 加入「我的筆記」捷徑及既有 Service Worker。已載入筆記的離線編輯草稿保存在該使用者瀏覽器，重新連線後送回伺服器；Service Worker 不會快取筆記 API 回應。

## 套用

將 `src/app/notes`、`src/app/api/notes`、`src/components/NotesWorkspace.jsx`、`src/components/NotesWorkspace.module.css`、`scripts/notes-schema.sql` 放入網站專案相同路徑；合併首頁 `/notes` 導覽連結及 manifest 捷徑。將 schema 附加到 `init.sql` 供新資料庫使用，並排除筆記 API 的 PWA 快取。

現有 PostgreSQL 資料庫需套用一次 `scripts/notes-schema.sql`。網站容器使用原本的 `DATABASE_URL`，不需要新增服務或另開連接埠。
