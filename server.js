import { createServer } from "node:http";
import next from "next";

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

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
