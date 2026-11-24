import { createServer } from "node:http";
import next from "next";
import { attachCallSignaling } from "./src/lib/hr-call-signaling.js";
import { callSecret } from "./src/lib/hr-call-ticket.js";

const dev = process.env.NODE_ENV !== "production";

// Fail fast: there is no default database connection string (see src/lib/db.js).
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Refusing to start without a database connection string (see .env.example).");
  process.exit(1);
}
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  // 聊天室通話的信令（WebSocket：/api/hr/call/ws）。沒有設定密鑰時不啟用，網站其他功能不受影響。
  const callSigningSecret = callSecret();
  if (callSigningSecret) attachCallSignaling(httpServer, { secret: callSigningSecret });
  else console.warn("Call signaling is disabled: set NEXTAUTH_SECRET (or HR_CALL_SECRET).");

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
