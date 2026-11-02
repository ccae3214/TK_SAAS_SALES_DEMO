## 這個 PR 做了什麼
<!-- 用一兩句話說明 -->

## 合併前請確認
- [ ] 我在自己電腦用 Docker 跑過，功能正常
- [ ] 沒有 commit `.env`、Token、金鑰或密碼
- [ ] 有改資料表嗎？
  - [ ] 沒有
  - [ ] 有，已在 `scripts/` 新增**可重複執行**的 migration（用 `IF NOT EXISTS`），並已告知要在正式資料庫執行
- [ ] 有改 `docker-compose.yml`、`nginx.conf` 或環境變數嗎？
  - [ ] 沒有
  - [ ] 有，已事先跟網站管理者說明
