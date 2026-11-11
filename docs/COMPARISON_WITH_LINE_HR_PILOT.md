# TK_SAAS_SALES_DEMO 與 line-hr-pilot 比較報告

> 歷史快照：本報告以合併前 ed3c2ab 為基準。後續已將 main 的 e939b40 合併進本機 wei，並實際建立隔離 PostgreSQL／啟動網站；「只有文件／未啟動」等敘述僅代表本報告當時。最新本機狀態、環境變數與畫面證據請看 [LOCAL_REVIEW.md](LOCAL_REVIEW.md) 及 [TASK_LOG.md](TASK_LOG.md)。前輪安全發現不能因 merge 或啟動成功就視為已修復。

日期：2026-11-04。閱讀入口：[PROJECT_MAP.md](PROJECT_MAP.md)。

## 1. 結論先講

新 repo 在「可編輯的人員／雇主／機構資料、雇主需求派單、跨國仲介媒合、履歷、實體文件上傳、聊天」的功能廣度明顯擴張；line-hr-pilot 則保有較完整的自動化測試、三語 LINE、通知 outbox、虛構資料展示與規格版本治理。

兩邊不是可直接 pull／merge 的同一條版本線。本輪已取得的 Git histories 沒有共同 commit，檔案結構與資料模型也不同；業務概念相承不代表程式或資料庫相容。建議將新 repo 視為接手後的主要候選、舊 repo 作需求與驗收參考，但是否正式換主線應由專案負責人決定。

目前不能因為功能較多或 Docker build 成功，就判定可放入真實移工個資。優先門檻為：worker 文件審核越權、仍追蹤的 ACME 私鑰、依賴弱點、資料揭露政策與 schema 變更治理。本輪只新增文件，沒有修正這些問題。

## 2. 比較基準與限制

| 項目 | TK_SAAS_SALES_DEMO | line-hr-pilot |
| --- | --- | --- |
| 來源 | `https://github.com/ccae3214/TK_SAAS_SALES_DEMO.git` | 本機既有 checkout |
| 比較分支 | `wei` | `release/v0.9.0-line-ui` |
| 精確 commit | `ed3c2ab575d79e7d142ec03516c9f0d9b561e47d` | `c0790153c5fe98034fe1fa36977650082ad8d3d0` |
| package 版本 | 0.1.0 | 0.9.2 |
| 追蹤檔案 | 129（本輪新增文件前） | 110 |
| 本輪遠端確認 | `git ls-remote` 確認 origin/wei 與 clone HEAD 一致 | 沒有 fetch；不保證是遠端最新版本 |
| 修改範圍 | 建立 `docs/project-map-comparison` 工作分支，新增兩份 docs，未 commit | 程式與文件均不修改，重跑既有測試 |

`git rev-list --all` 的兩邊 commit 集合交集為 0；這只證明目前取得的分支 histories 沒有共同 commit，不代表上游所有未抓取分支也無共同祖先。同路徑同內容檔案交集為 0；不能據此斷言沒有改寫／移植舊程式。

本報告根據原始碼盤點、Docker 映像建置、依賴稽核、隔離替身測試與舊專案回歸。沒有登入線上網站、沒有提供真實 secret、沒有連接 PostgreSQL 或外部 LINE／OAuth／Vercel。既有文件中的真人紀錄只當歷史證據，不冒充本輪實測。

## 3. 技術與產品差異

| 面向 | line-hr-pilot 現況 | 新 repo 現況與意義 |
| --- | --- | --- |
| 定位 | LINE／LIFF 人力流程與家人測試展示 | 整合型網站，含 HR、電商 Demo、筆記、品牌展示 |
| 前端 | 原生 HTML／JS；console、mobile-intake、line-simulator | Next App Router＋React，HR 管理與會員入口 |
| 執行環境 | 現行 Node／Vercel＋Neon；Compose 是獨立 Python／SQLite 歷史原型 | Docker Node 自訂 server＋PostgreSQL＋Nginx；另依賴外部 notebook／Cloudflare DDNS |
| 登入 | 管理 PIN／LINE 一次性 owner session；LIFF ID token、邀請與核准綁定 | Auth.js JWT、Email 密碼、Google／LINE Login；會員申請類型、管理者指派與白名單 |
| 角色 | owner、承辦、雇主、移工 | admin、worker、employer、agency；agency 分台灣／菲律賓；不等於已落實文件／訓練／招募／會計各職務最小權限 |
| 人員／雇主資料 | 虛構人物與流程為主，新增人員列為後續完善 | 已有新增編輯、機構歸屬、會員指派、履歷 JSONB、PDF 履歷擷取、照片讀取 |
| 配工媒合 | 沒有新 repo 這套完整派單模型 | 雇主 job order → 台灣機構／業務 → 菲律賓機構 → 推薦人選 → 面試 → 錄用建立案件 |
| 文件 | LIFF 只送 `DEMO-` 虛構檔名與版本，不收真實檔案 | PDF／JPG／PNG 真實 bytes；10 MB；AES-256-GCM 加密存 PostgreSQL、版本、下載稽核 |
| 文件清單 | 護照＋PSA 前置門檻、版本／補件 | 擴為新舊護照、ARC、PSA、NBI、TESDA、PEOS、SSS、LCR、TIN 等；具 applicability／applicable |
| 辦件程序 | 文件、體檢、訓練與總狀態 | 另有 PDOS、ACCR、UMID、OWWA、VISA、OEC、預定／實際入境日期 |
| 三語 | 繁中／English／Filipino，母語校對仍未完成 | HR 翻譯器只做 zh／en；LINE 依輸入中英判斷，未見對等的 Filipino 支援 |
| LINE | 角色 Quick Reply、LIFF 表單、一次性管理登入、三語訊息 | LINE Login＋Messaging 查詢、Flex 註冊／網站入口、事件去重；不是既有 LIFF 與 Quick Reply 的原樣延續 |
| 通知 | outbox、租約、重試／退避、固定安全 Push 範本、批次端點 | HR 提醒 UI／聊天室未讀、LINE 即時 Reply；未找到對等的持久化 Push outbox 工作佇列 |
| 聊天 | 雇主留言由內部轉達，避免雇主與菲律賓承辦直接聯絡 | 機構／案件聊天室與私訊；案件成員包含雇主、工人、兩側機構人員，須重新核對可見與可聯絡政策 |
| 展示隔離 | 訪客 localStorage 虛構資料、一鍵重設；持久化路徑另有界線 | HR 是共享 PostgreSQL 正式型操作；有會寫庫的測試 seed，不是每訪客獨立沙盒 |
| 規格治理 | 可編輯規格與版本歷史／安全回復、ROADMAP、TASK_LOG、驗收文件 | 尚未找到對等規格版本／回復入口與統一計畫／驗收主檔；本輪建立地圖與比較報告 |
| 自動測試 | 本輪 JS 109 通過／1 PostgreSQL 跳過，Python 26 通過 | 沒有 test script，也未找到標準 test/spec 測試檔；seed 與 deploy verify 不能取代權限回歸 |

以上「已存在」意指可從程式找到實作，不等於業務閉環、權限、安全或真人流程已驗收。

## 4. 需要特別核對的業務落差

### 4.1 前置文件門檻已不只是護照＋PSA

`src/app/api/hr/route.js:16-26,165-168,641,870-874`：建立文件清單時，多個沒有 applicability 描述的預設文件會同時設為 `entry_gate=true`。體檢與訓練檢查所有 entry_gate 的核准狀態，不只護照／PSA；但 README 與錯誤文案仍說護照＋PSA 通過即可安排。

這是程式／文件不一致，不宜自動認定新政策正確或擅自改回舊政策。需要負責人決定真正前置清單，再補回歸測試。

### 4.2 雇主可見範圍與舊版最小揭露不同

`src/app/api/hr/route.js:341-357,402-419`：雇主可讀本人案件、同台灣仲介的部分其他案件，以及尚未有開啟案件的工作者；有些欄位遮蔽，但 `resume_profile` 除照片外仍整包回傳。履歷含家庭、健康等欄位，不能把「可選工」等同「可看全部履歷欄位」。

`src/app/api/hr/documents/[submissionId]/route.js:30-33`：本人雇主可下載所屬案件文件。`src/lib/hr-line-bot.js:34-42,133-146`：雇主的文件、退回原因、體檢／訓練回覆也未見舊版同等的最小揭露分流。

上述為可定位的程式政策差異，沒有以真實資料重現洩漏。需先訂「公開選工卡／詳細履歷／健康／身分文件」的分層可見矩陣，以及同仲介不同雇主的隔離規則。

### 4.3 聊天與跨國承辦關係

聊天 API 的案件成員清單與建立私訊資格涵蓋兩側機構會員（`src/app/api/hr/chat/route.js:95-99,141-152`）。舊專案計畫明確不做雇主與菲律賓承辦直接聯絡；新模型可能形成不同聯絡途徑，應明確確認新政策，而不是只沿用既有 UI。

### 4.4 尚未找到足夠落實證據的原需求

- 移工先完成履歷並經獨立審查，才能進入媒合；會員角色核准不能自動等同履歷核准。
- 雇主資料／聘工需求先審查，再開放選工的獨立門檻。
- 10 家合作仲介的完整資料隔離與跨公司拒絕測試。
- 文件收件日／有效期限／個案補件／稽核完整欄位，不只名稱、適用性與版本。
- 會計／主管限定的 PHP／TWD 費用、退佣、月結、匯率及假日順延流程。
- 三語完整流程、失敗通知重試、正式資料備份還原演練。

這些項目列為「未找到對等實作或驗收證據」，不表示本輪已全面證明每個需求完全不存在。

## 5. 優先風險與證據

### P0：worker 可進入文件審查並寫入核准結果

位置：`src/app/api/hr/route.js:607-614,661-671,690,824-853`。

- PATCH 允許 worker 成為 principal；只對雇主設有前置全面拒絕。
- 690 行將 review 列在非 admin 仍可往下走的 action 中。
- review 分支僅在 principal 為 agency 時檢查菲律賓類型與機構歸屬，沒有排除 worker，也沒有 worker 本人案件限制。
- 替身測試以 worker 1 的 session、另一案件 999 的待審 submission 執行原始 PATCH，得到 200 且產生 review INSERT 與 requirement UPDATE。
- 對照：employer 得 403；跨機構的 philippines agency 得 403，兩者沒有 review write。

這是原始 handler 執行層的權限缺口，不是只有 UI 缺按鈕。測試用假的 auth／SQL 回應，未通過真實 HTTP／PostgreSQL；不宣稱線上資料已被竄改。應先明確允許 admin 或所屬菲律賓審核角色，其餘 fail closed，並新增 worker／跨案件拒絕測試。本輪未修權限，避免超出授權。

### P0：目前 Git 仍追蹤 ACME RSA 私鑰結構

`git ls-files` 可見 `certs/accounts/.../private_key.json`。只解析欄位結構確認 kty=RSA，且存在私密 d／p／q 欄位；沒有輸出或複製金鑰值。

上一筆 commit 的標題雖寫 stop tracking certs，實際 HEAD 仍含該檔，因此不能只相信 commit message 或 `.dockerignore`。是否仍使用、repo 可見範圍、已暴露多久，本輪未驗證。建議由擁有者評估撤換 ACME 帳號金鑰、停止追蹤與歷史處置；這涉及 secrets／不可逆歷史操作，需要另外授權。只加 ignore 也無法抹掉歷史。

另見 Compose／db adapter 存在非空預設資料庫密碼，seed 使用固定測試密碼並輸出到 console；本報告不重刊其值。不可讓這些預設成為正式環境憑證。

### P1：依賴稽核發現 critical／high

實際在建成的映像內，以原 lockfile 唯讀掛載執行 `npm audit --omit=dev --json`：exit 1，15 個受影響套件（critical 4、high 8、moderate 3）。直接依賴 `next`、`next-auth` 被標為 critical；4 個 critical 套件包含傳遞依賴，不代表 4 個已證實可利用的應用漏洞。

建置時 npm ci 的全依賴摘要另為 35（critical 4、high 11、moderate 20）；兩組掃描範圍不同，不應相加。

供後續追查的本輪 registry 回傳 advisory：
- Auth.js fail-open：`https://github.com/advisories/GHSA-8fpg-xm3f-6cx3`
- Auth.js OAuth 檢查 cookie：`https://github.com/advisories/GHSA-x445-f3h2-j279`
- Next 圖片處理：`https://github.com/advisories/GHSA-2464-fhr4-w9xw`

這是工具對 lockfile 的已知弱點比對，不是滲透驗證。需逐條判斷執行條件、升級後重跑登入／上傳／頁面測試，不能直接執行 audit fix --force 取代相容性評估。本輪未升級或修改 lockfile。

### P1：schema／資料變更藏在請求處理內

`ensureSchema()`、`ensureHrIdentitySchema()`、聊天 ensureRooms 與 Webhook 會 CREATE／ALTER／DROP constraints，也包含更新履歷與補齊所有案件文件／程序。已登入 GET `/api/hr` 不是純讀取；schema helper 還可能重複移除與建立 constraint。

風險是一般執行帳號必須有 DDL 權限、首次／並行請求會碰結構、規則改版會自動碰舊資料。建議改為版本化 migration、上線前備份與演練，再把應用 DB 帳號縮權。這些都需要獨立核准，本輪未啟動或遷移 DB。

### P1：真實文件安全與備份還未放行

已有加密、檔頭、大小、資料列鎖與下載稽核，是比虛構檔名更進一步的實作。但未找到惡意檔案掃描、加密金鑰版本／輪替、期限／刪除政策、加密備份還原與權限回歸證據。加密本身不會修正下載授權或敏感履歷 JSON 的可見政策。

DB 與加密金鑰必須分別妥善備份；失去金鑰無法解密，兩者一起外洩則加密不再保護資料。勿拿真實護照或醫療檔測試。

### P1：單獨 clone 後完整 Compose 無法使用

實際 `docker compose config --quiet` exit 1：找不到 repo 外 notebook 的 `.env`。此外 NEXTAUTH_SECRET 與 Cloudflare token 未設定。未自動產生 secrets，也沒有啟動會操作外部 DNS 的 DDNS 容器。

建議後續把 HR 本機必要的 app／postgres 與選用 notebook／DDNS／反向代理拆成 profiles 或獨立 Compose；這是建議，尚未實作。不要把本輪可 build 誤報成整組服務已能啟動。

### P2：文件、版本與品質門檻有漂移

- README 說有 Certbot／443／Fly SQLite；現行 Compose 沒 certbot、Nginx 只 80，也未追蹤 fly.toml。
- README 的 Windows PowerShell 驗證不符合本次 WSL 操作慣例；本輪沒有執行 Windows scripts。
- package 仍 0.1.0，Git log 的 v1.0 標題不能當正式驗收版本。
- `next.config.js` 明確忽略 build lint／型別錯誤，實際 build 也顯示 Skipping，build 成功不代表 lint／型別通過。
- HR API 是大型多 action handler、GET 先讀大量資料再在 Node 過濾，後續效能與維護成本較高；應把 scoped SQL 與 policy 測試一起整理。
- README 仍描述非 HR 訊息轉送 legacy webhook，但目前 handler 的 fallback 是本站固定說明，未見同等轉送。

## 6. 本輪實際驗證

執行主機為 WSL；應用編譯、套件稽核及密碼測試在 Docker Desktop 一次性建置／容器中完成。沒有啟動長駐網站、資料庫、Nginx、DDNS 或 notebook。

### 新 repo

【WSL】

    git clone --branch wei --single-branch https://github.com/ccae3214/TK_SAAS_SALES_DEMO.git <new-repo-root>
    git ls-remote origin refs/heads/wei
    git switch -c docs/project-map-comparison
    docker build -t tk-saas-sales-demo-review:wei .
    docker compose config --quiet

- clone／遠端 SHA 核對：成功，wei=ed3c2ab575d79e7d142ec03516c9f0d9b561e47d。
- Docker build：1 次通過，image `sha256:8f22587c3e64a949e8d96e9ac1e9d6f24adcc59ee7ff7b0a465865055155222d`。Next 15.5.14 編譯及 25 個靜態頁產出成功；不代表 25 個功能測試通過。
- build 警告：4 個 Docker ENV 舊寫法、Browserslist 資料較舊、npm 弱點；lint／型別檢查跳過。
- Compose config：1 次獨立檢查失敗（exit 1），原因如前；先前串聯讀取 Git 的 shell 最終 exit 0 不代表 Compose 成功，已另行獨立重驗。

【WSL】

    docker run --rm --user 0 --mount type=bind,source=<new-repo-root>/package-lock.json,target=/app/package-lock.json,readonly --entrypoint npm tk-saas-sales-demo-review:wei audit --omit=dev --json

- audit：exit 1，critical 4／high 8／moderate 3；未自動修正。

【WSL】

    docker run --rm --network none --mount type=bind,source=<new-repo-root>/src/lib/passwords.js,target=/review/passwords.js,readonly --entrypoint node tk-saas-sales-demo-review:wei --input-type=module -e 'import {hashPassword,verifyPassword} from "/review/passwords.js"; import assert from "node:assert/strict"; const h=await hashPassword("fictional-test-only"); assert(await verifyPassword("fictional-test-only",h)); assert.equal(await verifyPassword("wrong",h),false); assert.equal(await verifyPassword("x","malformed"),false); console.log("password checks: 3 passed, 0 failed");'

- 密碼函式：3 個斷言通過、0 失敗（正確密碼／錯誤密碼／格式錯誤 hash）。不是整體登入驗收。
- 第一次嘗試直接從 runner image 載入 `/app/src/lib/passwords.js` 失敗，因 standalone 不保留原始 src；改用來源檔唯讀掛載後通過。這是測試工具路徑修正，不是應用程式故障。

【WSL】

    node <scratch>/tk-review-authorization-probe.mjs

- 文件審核原始碼替身重現：worker 200 且 2 次 review 寫入；employer 403、跨機構 agency 403，兩者 0 次 review 寫入。最終 3 個角色案例符合觀察斷言，但 worker 結果是安全失敗，不能報成「權限測試通過」。
- 第一次探測對 employer 的假設錯誤，實際為 403；查證 671 行雇主 guard 後修正探測期待並重跑，最終沒有把雇主誤列成可越權角色。
- 附錄保留完整探測程式；auth、schema 與 SQL 都是替身，沒有實際資料庫寫入。

### 舊 repo

【WSL】

    bash scripts/session-preflight.sh
    env -u TEST_DATABASE_URL -u DATABASE_URL npm run test:spec
    python3 -m unittest discover -s tests -v

- preflight：exit 0，確認 WSL checkout／分支，Compose 無已建立容器。
- JavaScript：110 項，109 通過、0 失敗、1 真實 PostgreSQL 跳過。
- Python：26 通過、0 失敗；保留既有 SQLite ResourceWarning。
- PostgreSQL 整合、LINE／LIFF 真人、Production 沒有重測。

### 文件交付檢查

產檔後已執行兩邊 `git diff --check`（exit 0），並以 `git diff --no-index --check /dev/null <文件>` 補查兩份未追蹤文件，無空白錯誤診斷（no-index 因新增內容回 1，不當成 whitespace 錯誤）。第一次驗證腳本誤把這個 1 當錯誤，修正驗證判準後通過。

地圖完整索引精確涵蓋 129 個來源檔案＋2 份新增文件，共 131 個存在路徑，雙向文件連結正常；沒有本機 WSL 私人絕對路徑。附錄程式亦重新抽出執行，三角色結果與前述一致。最終 Git status：新 repo 僅新增 `docs/`，分支為 `docs/project-map-comparison`；舊 repo 仍在原分支且工作區乾淨。本報告不把歷史 TASK_LOG 的「未 commit」敘述當成當前 Git 狀態。

## 7. 建議接手順序（尚未執行）

1. 先處理 worker 審核越權與受追蹤私鑰；擁有者決定撤換與歷史處置，另行授權權限修正。
2. 補完整角色矩陣：管理者、台灣機構／業務、菲律賓承辦、雇主、工人，尤其文件下載、健康／家庭資料、跨雇主與跨機構。
3. 在不碰真實資料的隔離環境補 regression：worker 不能 review、跨機構拒絕、同機構跨業務、雇主選工公開欄位、文件版本／並行、配工重複錄用、聊天與照片端點。
4. 整理可獨立啟動的 WSL／Docker 開發環境；拆出選用外部服務，確保不誤啟 DDNS。
5. 核對護照／PSA 前置規則、三語、履歷／雇主需求審查門檻與通知閉環；從舊 repo 移植需求及驗收案例，不直接合併 schema。
6. 安排版本化 migration、相依套件更新、秘密管理、加密備份還原；最後才是真人 LINE／手機與小規模營運驗收。

結論：可以繼續以新 repo 開發，但現階段應是「功能擴張的待驗收候選」，不是「已安全承接 line-hr-pilot 的正式版」。本輪未 push、merge、deploy、改 secrets、調權限或執行資料庫初始化。

## 附錄：無真實資料的審核授權探測

以下為本輪實際探測程式。存成暫存 `.mjs`，將 root 指向 clone 的 repo，再以 Node 執行。程式只讀來源，將 import 依賴替換成假的 auth／DB，在 VM 內執行原始 PATCH。不是生產環境測試工具，也不是正式測試套件。

```javascript
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=process.argv[2]; // repository root, required
const raw=fs.readFileSync(`${root}/src/app/api/hr/route.js`,'utf8');
const code=raw.replace(/^import .*;\r?$/gm,'').replace(/^export /gm,'');
const factory=vm.runInNewContext(`(function(NextResponse,randomUUID,pool,query,auth,ensureHrIdentitySchema,getHrPrincipal,HR_ROLES,hashPassword){${code};return {PATCH};})`,{process:{env:{}},console,Buffer,URL,Date,Set,Map,Object,Number,String,Promise});
for(const role of ['worker','employer','agency']){
 const writes=[];
 const principal={role,worker_id:1,employer_id:1,agency_id:10,agency_type:'philippines',name:'fictional'};
 const client={query:async(sql)=>{
  if(sql.includes('SELECT s.id'))return {rowCount:1,rows:[{id:999,requirement_id:999,case_id:999,version_number:1,latest_version:1,agency_id:20}]};
  if(sql.startsWith('INSERT INTO hr_document_reviews')||sql.startsWith('UPDATE hr_case_requirements'))writes.push(sql.split('(')[0]);
  return {rows:[],rowCount:0};
 },release(){}};
 const pool={query:async()=>({rows:[],rowCount:0}),connect:async()=>client};
 const api=factory({json:(body,options={})=>({status:options.status||200,body})},()=> 'fictional-id',pool,async()=>[],async()=>({user:{email:'fictional@example.invalid'}}),async()=>{},async()=>principal,new Set(['worker','employer','agency']),async()=> 'unused');
 const result=await api.PATCH({url:'https://review.invalid/api/hr',headers:new Headers({origin:'https://review.invalid'}),json:async()=>({type:'review',submissionId:999,decision:'approved'})});
 if(role!=='worker'){assert.equal(result.status,403);assert.equal(writes.length,0);}else{assert.equal(result.status,200);assert.equal(writes.length,2);}
 console.log(JSON.stringify({role,status:result.status,reviewWriteCount:writes.length,scope:'source-executed with mocked auth and database, no real data'}));
}
```
