# 已合併 PR 重大風險審查與部分修復

## 結論與範圍

本輪以 `origin/main=52b0d7cfda4aaf378c8232c4fcec62d34f49d789` 為凍結基底，另建 `fix/merged-pr-review`。GitHub 列出以 main 為目標的已合併 PR 共 19 筆；本輪按資料損壞與權限風險優先審查，不宣稱 19 筆所有業務／裝置皆經完整 E2E。#22 仍為 OPEN／Draft，未納入本分支，不把未合併的通知測試冒稱 main 原有功能。

確認四項高優先資料一致性風險，其中三組在本 PR 修復；文字 webhook 重送未修，另需持久去重設計／schema 授權。修復者同時撰寫本報告，屬實作者自我審查，不是獨立核准、完整安全稽核或正式放行。

## Findings（依嚴重度）

### F1｜P1｜圖片待確認狀態先提交，實際入帳失敗後無法重試（#21）｜已修

- 基底位置：`accounting-bot/commands.py:125-141`，先 `set_pending_status(...,'done')`，之後才以另一連線 `add_bill`／`add_expense`；`db.py` 每次操作個別 commit。
- 影響：SQLite 寫入錯誤時，沒有帳目卻已消耗待確認項目；另若使用者修改金額與確認並行，確認可將讀取時的舊值入帳。
- 先驗證：真實檔案 SQLite 上加入僅限暫存測試 DB 的失敗 trigger；確認與加入帳單兩種動作都證實失敗後 pending 消失。另一案例在初次讀取後修改 360→999，原碼卻記 360。不是對正式帳本注入故障。
- 修復：`Store.record_pending()` 在 `BEGIN IMMEDIATE` 下依 chat／id／pending／期限重讀最新資料，插入帳目與狀態切換共用一個 transaction；失敗全回滾。聊天回覆也取鎖內實際入帳內容。取消與確認／加入帳單競爭仍只消耗一次。
- 回歸：`accounting-bot/test_atomic_writes.py` 的插入失敗／重試、舊值競爭與同時確認／加入帳單。

### F2｜P1｜固定帳單付款不原子，並行或失敗造成重複／半套記帳（#19／現行 #21 路徑）｜已修

- 基底位置：`accounting-bot/commands.py:231-242`，`paid_bill_ids`、`add_expense`、`mark_paid` 是分開提交。付款唯一鍵只擋住 payment marker，擋不住前一步已提交的兩筆 expense。
- 先驗證：兩個真正的執行緒同時讀取同一帳單，原碼建立兩筆 expense、一筆 marker；marker 插入失敗時，原碼保留已提交的 expense。
- 修復：`Store.pay_bill_once()` 在同一 SQLite write transaction 重新確認帳單與本期付款、一起建立 expense／marker；重複命令回「已經標記」，不再建立另一筆。保留共用帳本與既有期間規則，無 schema 變更。
- 回歸：真實檔案 SQLite、並行付款、marker 故障、故障恢復後重試。

### F3｜P1｜HR 訓練／案件進度的跨表寫入及階段重算不在同一交易（#20）｜已修

- 基底位置：`src/app/api/hr/route.js:1340-1368` 逐條 pool query 更新案件、worker mirror、活動、階段；`src/app/api/hr/agency-workers/[id]/route.js:211-212,255-260` 先 commit 狀態／步驟，再重算 stage。
- 影響：API 可回 500，但訓練狀態已改、worker／case／stage 不一致；讀狀態後未鎖定也容許較舊的合法轉換蓋回已完成狀態。
- 先驗證：執行實際 handler 分支與 DB double，原碼的五項交易回歸全部失敗，明確留下部分更新；此層不是 HTTP／真實 PostgreSQL。
- 修復：案件入口用單一 client transaction，角色／機構與狀態重查、mirror、活動、stage 共用 client；worker 入口將 stage 移入既有 transaction。兩個狀態入口以 worker row lock 序列化。沒有更改角色授權政策、文件門檻或狀態機。
- 真實 PostgreSQL 驗證：對指定寫入位置送出 `SELECT 1/0`（SQLSTATE 22012），確認 case／worker／steps／activity 全回滾；成功提交與兩入口並行亦驗證。另有實際登入 HTTP＋DB postcondition，並測跨機構／錯誤來源／匿名拒絕。
- 測試邊界：PostgreSQL 測試執行真實 handler 分支及真實 stage helper，但注入 principal／DB adapter；HTTP 測試才包含實際登入與路由。兩者都不是瀏覽器點擊 E2E。

### F4｜P1｜相同文字 webhook 重送會重複入帳（#19／現行 main）｜確認但未修

- 位置：`accounting-bot/app.py:120-124`，直接 `bot.handle`；只有圖片用 `pending_receipts.message_id` 去重，文字沒有持久事件去重。
- 已實際將同一 `webhookEventId`、message id、簽章正確的「DEMO午餐 120」payload 送到真正 Flask test client 兩次：HTTP 均 200，expense count=2，預期冪等應為 1。此探針只用記憶體 SQLite 與假的 LINE 傳輸，沒有外部請求。
- 這不是 F2 的同一問題：本 PR 讓固定帳單的狀態轉換冪等，不能因此宣稱一般文字記帳已能抵抗 webhook 重送。
- 未擅加持久去重表或把純文字事件塞進圖片表；程序記憶體集合也不能解決重啟／多程序。下一步須明確核准持久 event key、處理狀態、保存期限，以及事件 claim 與帳目同交易的設計／schema。正式帳本是否已有重複需另行唯讀盤點，不可直接刪除歷史。

## 審查涵蓋與未外推

| 範圍 | 實際深度／結論 |
| --- | --- |
| #19、#21 記帳與圖片 | 閱讀 app／commands／Store／images／vision；完整既有 87 測試加本輪 6 個真實 SQLite 回歸共 93 通過；F1／F2 已修，F4 未修 |
| #20 訓練與來台文件 | 閱讀純流程、stage helper、兩個寫入入口；回滾／狀態轉換／權限範圍／真實 DB／HTTP 驗證，F3 已修；完整訓練中心、OEC／簽證／抵台閉環未全跑 |
| #12、#16、#18 媒合／帳號同步 | 讀共用交易、相關 route 授權；從已合併 31a9dd1 原樣恢復原 85 項單元並通過；未把歷史 26／15／20 個瀏覽器測試當成本輪結果 |
| #7、#9 文件重構及下載／上傳路徑 | 閱讀文件歸屬、row lock、版本、AES-GCM／雜湊及下載範圍；文件規則基線有單元，真實附件歷史／掃毒／完整租戶矩陣未驗，沒有全面安全核准 |
| #4-6、#13-15 PDF／照片、#8／#10／#11 UI | 有列冊／目前相關流程來源盤點；未完整逐項裝置驗收，不列通過 |
| #1／#2 workflow 與後續直接 main commits | 讀目前 CI；本輪恢復 HR 單元步驟；self-hosted 正式部署與每個歷史 workflow 的安全性未完整驗收 |
| 仲介互貿、訓練中心、新手導覽等直接 main 更新 | 讀目前 certification store／scope／identity 與相關入口，未完成全矩陣；訓練中心全域符合條件工人名單、記帳全聊天室共用帳本是已明載現行政策，未自行改成隔離政策 |
| #22 | 未合併，獨立分支／Draft PR，未整合、未測其通知功能 |

## 修改檔案導覽

- `accounting-bot/db.py`、`commands.py`：兩個不改 schema 的原子寫入入口，維持原共用帳本、付款與圖片確認文案。
- `src/app/api/hr/route.js`、`agency-workers/[id]/route.js`：同一 client／worker row lock／階段重算交易；角色與機構條件照 main。
- `accounting-bot/test_atomic_writes.py`：6 項真實暫存 SQLite 故障／並行測試。
- `tests/hr-workflow-atomic.test.mjs`：10 項來源 handler 分支＋DB double／授權／鎖定回歸。
- `tests/hr-workflow-atomic.postgres.mjs`：8 項真實 PostgreSQL；並行案例內做 5 組兩入口並行，不當作完整壓測。
- `tests/hr-workflow-atomic.http.mjs`：3 項實際認證 HTTP＋DB postcondition，不冒充 UI E2E。
- `tests/hr-candidate-withdrawal.test.mjs`、`hr-linked-record-store.test.mjs`、`hr-workflow.test.mjs`、`scripts/test-hr-requirements.mjs`：從已合併 31a9dd1 原樣恢復；`scripts/test-hr-case-flow.mjs` 從已合併 6ca46d3 恢復。沒有刪掉或放寬基線斷言。
- `package.json`、`.github/workflows/ci.yml`：恢復可重跑 `test:hr` 並放入 build job；只有指令不等於遠端 CI 已通過，結果依 PR 精確 head 讀回。
- `.gitignore`／`.dockerignore`：舊 #22 本機 trace／報告不進 Git 或 build context，不發布可能含 cookie 的原始產物。
- README、LOCAL_REVIEW、ROADMAP、TASK_LOG、VERIFICATION_REPORT、PROJECT_MAP 與本報告：更新有效入口／範圍，不覆寫舊審查報告。

## 實際驗證

| 驗證 | 本輪最終結果與限制 |
| --- | --- |
| 修改前 SQLite 新回歸 | 5 失敗／1 通過，確認 F1／F2／舊值競爭 |
| 修改前 HR 核心交易回歸 | 0 通過／5 失敗，確認 F3；DB double，不是真實 DB |
| Docker Node 20 `npm run test:hr` | 104 通過／0 失敗／0 跳過（85 原基線＋9 PR20 流程＋10 新交易回歸） |
| Docker Python 3.12 全部 pytest | 93 通過／0 失敗／0 跳過（87 原基線＋6 新測試）；WSL 3.14 也曾跑 93 通過，不取代 3.12 證據 |
| 真實隔離 PostgreSQL | 8 通過／0 失敗／0 跳過；真實 SQL 錯誤、成功寫入、狀態拒絕與兩入口並行 |
| 真實登入 HTTP＋PostgreSQL | 3 通過／0 失敗／0 跳過；admin 更新、step 同步、跨機構／來源／匿名拒絕 |
| Next Docker build | 通過；lint／型別依既有設定跳過，Browserslist 警告未修 |
| app runtime | 重建僅隔離 app；image 與 tag 相同，`sha256:591d0918492a096cafb6faa5ff4fdeeb9d7fe894936826e2bee7ee93c26786a3` |
| accounting-bot Docker build | 通過，使用 Python 3.12；未啟動正式 bot、提醒或外部 provider |
| diff／語法 | `git diff --check` 與變更 JS 語法通過；最終 staged check 另於提交前執行 |
| production npm audit | 實際 `npm audit --omit=dev` exit 1：15（3 moderate／8 high／4 critical），包含直接依賴 next、next-auth；未升級、不列通過。build 的全依賴 27 包含 dev，兩者不能混為一談 |

第一次 Docker Python pull 被本機 Windows credential helper 阻擋；對公開官方 image 改用獨立暫存空 Docker config 成功，沒有修改既有 credentials。未把第一次失敗列為測試斷言失敗，也未以 WSL 不同 Python 版本替代最終 3.12 驗證。

### 可重跑指令

先決條件：Docker Desktop、已核准且已初始化的虛構 `tk_saas_review`、既有忽略檔 `.env.review.local`、Node 鎖定依賴；沒有環境時回報缺口，不自行初始化 schema／重設 volume 或建立 secrets。網路名稱依目前 compose project 為 `tk-saas-local-review_default`。

【WSL】repository root

```bash
docker run --rm --network none -v "$PWD:/work:ro" -w /work node:20-alpine npm run test:hr
docker run --rm -v "$PWD/accounting-bot:/work:ro" -w /work -e PYTHONDONTWRITEBYTECODE=1 python:3.12-slim sh -c 'pip install -r requirements-dev.txt && python -m pytest -q -p no:cacheprovider'
docker run --rm --network tk-saas-local-review_default --env-file .env.review.local -e LOCAL_REVIEW_ONLY=1 -v "$PWD:/work:ro" -w /work node:20-alpine node --test tests/hr-workflow-atomic.postgres.mjs
docker compose --env-file .env.review.local -f compose.review.yaml build app
docker compose --env-file .env.review.local -f compose.review.yaml up -d --no-deps --force-recreate app
docker run --rm --network tk-saas-local-review_default --env-file .env.review.local -e LOCAL_REVIEW_ONLY=1 -v "$PWD:/work:ro" -w /work node:20-alpine node --test tests/hr-workflow-atomic.http.mjs
docker build -t tk-saas-accounting-review:merged-pr-review accounting-bot
git diff --check
```

若公開 image pull 遇 credential helper 問題，由 Agent 用獨立暫存 Docker config 取公開 image，不修改使用者的登入設定。HTTP script 在隔離 network 使用 app:3000，維持 canonical localhost:8088 Host／Origin；不更動認證設定。

### F4 的最小可重現探針

以下只用記憶體 DB、虛構 secret、Flask test client 與假的 LINE，執行後目前會印出 `2`。這是已知缺陷的觀察，不是預期通過的產品行為；不要把數字 2 寫成驗收標準。

【WSL】在 accounting-bot 目錄，使用已安裝 requirements-dev 的 Python

```python
import base64, hashlib, hmac, json
from app import create_app
from config import Config
from db import Store
class FakeLine:
    def reply(self, *args, **kwargs): pass
    def push(self, *args, **kwargs): pass
store = Store(':memory:')
config = Config(channel_secret='fictional-review-only', enable_scheduler=False)
client = create_app(config, store, FakeLine(), submit=lambda *args: None).test_client()
body = json.dumps({'events': [{'type': 'message', 'webhookEventId': 'DEMO-same-event', 'replyToken': 'DEMO-reply', 'source': {'type': 'user', 'userId': 'DEMO-user'}, 'message': {'type': 'text', 'id': 'DEMO-same-message', 'text': 'DEMO午餐 120'}}]}).encode()
sig = base64.b64encode(hmac.new(config.channel_secret.encode(), body, hashlib.sha256).digest()).decode()
for _ in range(2):
    assert client.post('/callback', data=body, headers={'Content-Type': 'application/json', 'X-Line-Signature': sig}).status_code == 200
with store._conn() as conn:
    print(conn.execute('SELECT COUNT(*) FROM expenses').fetchone()[0])
```

## 資料與回復邊界

- 本 PR 沒有新增／修改 schema、trigger、migration、權限授予或認證規則。SQLite 故障 trigger 只存在 pytest 的暫存 DB；HR 測試不建 trigger、不改 catalog，只在既有隔離 DB 建虛構 fixture，結束關閉案件／停用人物，保留歷史、不刪資料。
- 沒有發真實 LINE／呼叫 Anthropic，也沒有使用正式 DB、刪 volume、啟用排程、合併 main 或部署。
- 回退應用不會自動修復原先已重複／漏記的資料；須另行批准正式資料盤點與修復，不以刪除歷史代替回復。
- 舊 #22 通知 worker 不在這個 main-based image；本機目前服務的是本 PR 修復候選，不是 #22 通知候選。兩個 PR 應分別 review，後合併者需更新基底與重跑測試。
- 不宣稱已驗真實 LINE／Anthropic、iPhone／WebView、全部 19 個 PR 的 UI、完整權限／跨租戶／附件／壓力矩陣或所有歷史遷移；依賴 critical 與 F4 仍是正式放行前風險。
