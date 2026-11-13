# 會員送審通知與流程測試｜實作者自我審查

## main 52b0d7c 整合增補（目前候選）

本輪依使用者「遵循 main」，保留上游新版首頁、新手導覽、履歷與翻譯；三個衝突合併雙方必要行為，不覆蓋為單側版本。僅更新同一 Draft PR #22，不合併 main／部署。下文 7093129、延遲量測與舊截圖為首次交付紀錄，不能當成新版畫面或精確 CI。

- 本次先停 app、備份、實際還原且 7 組資料計數一致，再由 main 新增 hr_members.onboarding_seen；catalog 比對只多該欄，無欄位移除／修改。教育程度資料轉換未執行。
- 衝突：.gitignore 保留排除；HrManagement 保留 HrOnboardingTour、data-tour 導航與會員通知，語言工具仍 inline 在側欄；hr-translations 保留 data-tour 與 inline 兩種需求。
- build 成功並核對執行 image。單元 110、真實隔離 DB 13、桌機／手機 E2E 16 最終皆通過，均 0 失敗／跳過。build 仍跳過 lint／型別。
- 測試先遇登入路徑舊預期（1 失敗），再遇菲律賓仲介的英文 agency 導覽與 helper 假設不符（完整 14 通過／2 失敗）；改成 main 精確 / 路徑、實際角色／中英導覽 UI 操作及 POST／seen 持久化檢查，完整重跑 16 通過。原業務斷言不刪除／放寬。
- 合併前 staged diff check 指出上游搬移 demo/page.jsx 的既有空白，未擅改；工作區與相對最新 main 的本輪 diff check 通過。CI／可合併性依 PR 精確 head 讀回；詳細命令與備份 checksum 見 VERIFICATION_REPORT 最新段落。

## 結論與有效入口（首次交付歷史）

2026-11-13 本機候選已完成：會員送審 → 全站 admin 站內提醒 → 正確會員審核 → 申請人重新確認核准結果。基底起於 main `809259b`，交付前已整合 main `709312930bc917755552b6f7887dbeceb96a9107` 並重新建置／驗證。工作分支 `feature/hr-member-request-notifications`，未 push、未開 PR、未合併 main、未部署。

- Windows 瀏覽器：http://localhost:8088/hr/login
- 操作唯一入口：[LOCAL_REVIEW.md](LOCAL_REVIEW.md)
- 機器證據：[member-notification-results.json](review/member-notification-results.json)
- 畫面：[桌機](review/member-notifications-desktop.png)、[390px 手機 Chromium](review/member-notifications-mobile.png)
- 本文是實作者自我審查，不是合作人獨立核准。

## 功能說明與完成項目

1. 全站 admin（含最高管理者、不含仲介管理者）取得獨立待審摘要，前景每 5 秒更新、focus／重新可見時補抓。摘要和主編輯資料分離，聊天或通知請求失敗保留上次提醒、不假顯示零筆。
2. 通知顯示待審數與前 10 位申請者，可前往全部會員；進入審核前重讀主資料。視窗顯示申請者姓名，取消不寫入；已處理的舊連結不重開審核。
3. 有正在編輯的表單／案件時不得切換至新申請；通知背景更新不覆蓋草稿，導航讀取期間也重查編輯阻擋狀態。
4. 送審與通知入列在同一 PostgreSQL transaction；相同身分並行送審會序列化，會員狀態／所選機構在鎖內重查。入列失敗則會員申請一起回滾；LINE 失敗不回滾已提交的業務。
5. LINE 接收者按既有有效管理權限與綁定取得。環境最高管理者無會員資料列也可入列；相同 LINE ID 去重。Email-only admin 仍可看站內提醒，不假造可推播身分；仲介管理者、停用的一般 DB 管理者不進收件名單。既有環境白名單優先語意不變。
6. 提供背景 worker、row-lock／SKIP LOCKED、隨機 lease ownership、固定 LINE Retry Key、指數退避、最多 5 次及安全嘗試紀錄。只在 LINE 受理或有 accepted-request-id 的重試衝突時標記 sent；此狀態只表示 API 受理，不是送達／已讀證據。發送前再查申請狀態、權限和綁定，失效即取消。
7. 初次送審後可嘗試 after-response 快速投遞；背景 worker 才負責持續重試與恢復。worker 預設停用，需 HR_NOTIFICATION_WORKER_ENABLED=1；本機 compose 的 notifications profile 沒有 LINE token，不能發真實 LINE。缺設定時不搶單、不耗重試次數。
8. 通知只包含最小提醒與需登入的審核深連結，不帶文件、自由文字或憑證；不把 provider 原始錯誤寫入紀錄。有 zh／en／tl 簡短模板，但未作母語校對。
9. 恢復 #18 的原 85 項單元基線、增加 25 項通知測試及可重跑的 Playwright Test；GitHub build workflow 加上 test:hr，但遠端 CI 尚未執行。

## 檔案與審查重點

| 檔案 | 內容／應注意處 |
| --- | --- |
| src/lib/hr-notifications.js | 唯一新通知表、共同交易、權限映射、最小訊息、租約／去重／重試；與 hr-access.js 的既有環境與 system scope 語意對齊 |
| src/app/api/hr/member-request/route.js | 保留登入／同來源／業務類型檢查，改用共同交易；排程只處理本次入列 ID |
| src/app/api/hr/notifications/route.js | 全站 admin 專用 GET、同一 snapshot 計數與預覽、no-store；401／403 拒絕已驗 |
| src/components/HrMemberRequestNotifications.* | 獨立輪詢、失敗保留結果、編輯阻擋、手機面板定位 |
| src/components/HrManagement.jsx | 重讀正確會員、處理深連結、顯示被審核者及防導航期間覆蓋草稿 |
| src/lib/hr-translations.jsx | 僅新增 inline 選項供管理後台使用，語言按鈕移至側欄頂部避免蓋住通知；其他頁預設位置不變 |
| scripts/hr-notification-worker.mjs、Dockerfile | 可明確啟用的持久工作程序；有本機 DB target guard，production 尚未設定／啟動 |
| compose.review.yaml、playwright.config.mjs、scripts/review-browser-proxy.mjs | 固定官方瀏覽器版本、分享 app 網路並維持原 localhost callback origin；測試 proxy 僅 loopback、生命週期由測試管理 |
| tests/、scripts/test-hr-requirements.mjs、scripts/test-notification-store.mjs | 原基線、受控傳輸／真實 DB 故障與搶單、跨角色 UI 案例；未 skip／放寬業務斷言 |
| scripts/prepare-notification-review.mjs | 只新增虛構待審／未申請帳號，拒絕非 review DB，不重設既有資料 |
| .gitignore、.dockerignore、package*.json、.github/workflows/ci.yml | 保留跨平台 lockfile；明確追蹤 root scripts／tests，原始 trace／報告及憑證不得入 Git／image |

## DB、相容性與回復邊界

使用者已明確批准本輪「一張通知佇列表＋必要索引，以及僅在 tk_saas_review 套用 main 既有 schema／建立虛構資料」。先做 pg_dump，實際還原後 7 組關鍵資料計數一致，未刪 DB。證據只包含安全計數與 checksum，不公布備份實體路徑或連線資料。

與備份 DB 的 catalog 比對新增：本輪的 hr_notification_outbox，以及已批准 main 既有的 hr_agency_certifications、hr_worker_health_training、hr_worker_progress_steps；沒有移除 table。既有資料仍保留，測試產生的會員／關聯資料另以唯一虛構標記識別，結束後停用而非刪除。

- hr_notification_outbox 保存事件鍵、最小路由、狀態／次數／租約／重試時間與安全嘗試紀錄；唯一鍵為 event_key + recipient_line_id，delivery_key 固定。
- 新會員的相同送審重送不重播 LINE；修改待審內容仍由站內資料反映。本輪沒有創造會員退回／撤回／重新申請產品流程。
- 舊待審會員顯示站內摘要，但不自動補發歷史 LINE；後來才綁定的管理者也不倒灌舊事件。收件名單為事件建立時快照，發送前再驗有效性。
- 永久錯誤與超過 5 次重試進 failed；需調查後另行處理，沒有讓瀏覽器任意復活 failed 的入口。不宣稱 provider 限制之外的絕對 exactly-once。
- 回復應先停 worker／寫入再退應用，保留通知表與歷史，不 drop table 或倒灌舊正式資料。本輪未執行破壞性回復。

## 實際執行與結果

以下在 repository root 的 WSL 執行；app／DB／瀏覽器均在 Docker。需既有 .env.review.local、已初始化的隔離 review DB，以及已安裝的鎖定依賴。

【WSL】
```bash
docker run --rm --network none -v "$PWD:/work:ro" -w /work node:20-alpine npm run test:hr
docker compose --env-file .env.review.local -f compose.review.yaml build app
docker compose --env-file .env.review.local -f compose.review.yaml up -d --no-deps --force-recreate app
docker compose --env-file .env.review.local -f compose.review.yaml run --rm --no-deps e2e node --test scripts/test-notification-store.mjs
docker compose --env-file .env.review.local -f compose.review.yaml run --rm --no-deps e2e
docker compose --env-file .env.review.local -f compose.review.yaml run --rm --no-deps notification-worker node scripts/hr-notification-worker.mjs --once
git diff --check
```

| 驗證 | 結果與界線 |
| --- | --- |
| Node 20 原基線＋通知單元 | 110 通過、0 失敗、0 跳過；原基線 85 保留，新增 25 |
| 真實 PostgreSQL＋受控發送函式 | 13 通過、0 失敗、0 跳過；包含回滾、真正並行、排程、權限／綁定撤回、過時申請、失去 lease 的 ack、防重試越權及環境 root |
| Playwright Test 桌機＋390px 手機 Chromium | 8 個案例各跑兩種 viewport，16 通過、0 失敗、0 跳過、0 flaky；每例檢查 pageerror，均為 0 |
| 前景站內提醒量測 | 桌機 4325ms、手機 4666ms；只代表本次本機量測，不是正式站／LINE SLO |
| Docker build／執行 image | 通過，運行容器與候選 image ID 相同；未將 test-results、playwright-report、tests、私有 env 放入 runtime |
| worker 實際入口 | 缺 LINE 設定時 claimed=0、configurationMissing=true；未發真實 LINE，不稱投遞成功 |
| HTTP smoke | login 200，匿名通知摘要 401；其他角色 403 由 E2E 驗證 |
| 原始 artifacts 排除 | Git ignore／Docker runtime 實查；trace 可能含測試密碼與 cookie，只留本機，不進 Git |
| npm audit --omit=dev | exit=1；15 項警告（3 moderate／8 high／4 critical），包含 next／next-auth；未自動修復，不列通過 |

初輪 E2E 為 9 通過／7 失敗：select 的可及名稱包含選項而不是純標籤、API fixture 沒附既有 Origin，以及手機面板向左溢出。另將 BIGINT ID 比對對齊其資料型別。修正定位／fixture 並維持原狀態與資料斷言，修正產品 CSS 後完整重跑。截圖複核再發現語言工具遮住通知數字，改為管理側欄頂部的 inline 語言工具，追加 hit-test 與語言入口 viewport 斷言後再完整重跑 16 通過；未隱藏導航或放寬邊界。

## 你／合作人怎麼看

1. Windows 瀏覽器開 localhost:8088/hr/login，以 review.admin@example.invalid 登入；密碼僅從本機 .env.review.local 的 REVIEW_LOGIN_PASSWORD 讀取。
2. 點上方「待審會員」，選本輪保留的「DEMO manual-pending e549e921」。取消應不改資料；再開啟核准為工作者／所屬菲律賓仲介。
3. 用另一個瀏覽器 profile 登入該虛構申請者，確認可重新讀取已核准工作區；完整虛構 Email 看 LOCAL_REVIEW 或機器證據。不要在一般分頁混用角色 cookie。
4. 自動重跑看上方三組指令與結果，不需逐一手點。HTML／trace 在本機 playwright-report、test-results；不要直接公開原始檔。

## 額外改動／建議與未驗範圍

- main 更新已保留；accounting-bot、正式 compose、Nginx、環境範例及 HR 認證核心未另行改寫，不混用記帳 Bot。上游重新忽略 scripts／tests，這次僅明確恢復 root 驗證路徑的追蹤，保留其他 ignore 規則。
- npm 警告來自現有鎖定產品依賴；本輪只新增固定 Playwright 開發依賴，沒有刪跨平台選用套件或升級產品版本。稽核不是正式環境漏洞可利用性驗證，建議另案評估修補後再部署，不在本輪擅自 npm audit fix。
- build 仍依既有設定跳過 lint／型別，不算通過。遠端 GitHub CI 尚未執行；新增 workflow 指令不能當遠端成功證據。
- 未驗真實 LINE／Google、手機送達／已讀、iPhone／Safari／LINE WebView、母語校對、全部 UX／跨租戶／壓力矩陣。
- 新 E2E 是會員閉環，不是全站測試平台；舊 Python 26／15／20 屬歷史，未宣稱本輪重新跑過。媒合、文件退補件、互貿與訓練完整瀏覽器流程尚待後續納入。
- 本輪只在本機隔離環境套用；正式 DB schema、worker 運維、真實通知、secrets、push／PR、main 合併與部署皆未執行。
