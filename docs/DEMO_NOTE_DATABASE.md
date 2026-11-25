# DEMO／NOTE 資料庫

舊 DEMO 商店與 NOTE 筆記資料已移至同一個 PostgreSQL 伺服器上的獨立資料庫 `saas_demo_content`，與 HR 使用的 `kolecion_db` 分開。新資料庫由非管理者角色 `demo_notes_app` 擁有，且已撤銷 `PUBLIC` 的連線權限；這個角色無法連線至 HR 資料庫。

本機 `.env`（已列入忽略，不要提交）保存 `DEMO_NOTES_DATABASE_URL`；HR 繼續使用 `DATABASE_URL`。若將已保存的 DEMO／NOTE 程式複製到新專案，該專案的 `DATABASE_URL` 設為 `DEMO_NOTES_DATABASE_URL` 的連線值，便會連到隔離的資料庫。HR 專案不要使用這個連線值。

遷移前備份位於 `backups/saas_demo_content_before_move_*.dump`。目標資料庫恢復並以專用登入確認後，來源 `kolecion_db` 中舊 DEMO／NOTE 資料表已移除；HR 資料表未遷移或刪除。實際移轉有 12 筆商品、3 個舊商店帳號、5 筆筆記；其餘已移轉的舊商店／筆記表原本為空。資料表包括 `products`、`users`、`orders`、`order_items`、`inquiries`、`news`、`coupons`、`newsletter`、`reviews`、`note_folders` 與 `user_notes`。

目前 DEMO／NOTE 程式碼已不在此專案；本檔記錄資料庫位置與連線方式，方便已保存的副本使用。
