# 來電通知設定

聊天室有人撥號時，對方不在線上（沒開網頁、手機鎖屏）也會收到通知：

1. **網頁推播（Web Push）**：像 App 一樣跳出通知，點開就進網站接聽。
2. **LINE 備援**：沒有開啟網頁通知（或推播沒送到）、但已綁定 LINE 的會員，改收 LINE 訊息。預設只在網頁推播沒送到時才用 LINE，以節省 LINE 每月的推播額度。

在線上的人仍然是網頁內的來電視窗與鈴聲，不會重複通知。響鈴 10 秒還沒人接時，連著網頁但可能在背景的人會再補發一次通知。

## 一次性設定

1. 產生推播金鑰（在專案根目錄執行）：

```
npx web-push generate-vapid-keys
```

2. 把兩把金鑰寫進伺服器的 `.env`（私密金鑰不可外流，也不要放進 GitHub）：

```
HR_PUSH_VAPID_PUBLIC_KEY=（Public Key）
HR_PUSH_VAPID_PRIVATE_KEY=（Private Key）
HR_PUSH_SUBJECT=mailto:你的信箱
HR_CALL_LINE_NOTIFY=fallback
```

`HR_CALL_LINE_NOTIFY`：`fallback`（預設）／`always`（兩種都送）／`off`（不用 LINE）。LINE 備援需要已設定 `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`。

3. 重建並重啟：

```
docker compose up -d --build app
```

沒有設定金鑰時，網站不會顯示「來電通知」按鈕，其他功能不受影響（LINE 備援仍會運作）。換金鑰後，每位使用者要重新開啟一次通知。

## 使用者怎麼開啟

- **Android／電腦**：聊天室右上角按「來電通知」→「開啟來電通知」→ 允許。
- **iPhone（iOS 16.4 以上）**：必須先用 Safari「加入主畫面」（頁面上的「加到手機桌面」），從桌面圖示開啟網站後才能開啟通知。LINE 等 App 內建瀏覽器不支援。
- 開啟後可按「傳送測試通知」確認收得到。

## 限制

- 網頁推播使用系統預設通知音，不會像網頁內的鈴聲一直重複響到接聽。
- 通知只在響鈴的 45 秒內有意義，推播的有效期限也是 45 秒；錯過要回撥。
- 每位收件人每分鐘最多收到 3 則來電通知。
- 通知網址只接受 Chrome／Firefox／Safari／Edge 的推播服務，其他網址一律拒絕。
