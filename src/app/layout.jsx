import "./globals.css";
import Providers from "./providers";
import { headers } from "next/headers";

export const viewport = { viewportFit: "cover" };

export const metadata = {
  title: "克雷迅人力仲介管理系統",
  description: "克雷迅人力仲介管理與工作者服務平台",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "克雷迅",
  },
};

export default async function RootLayout({ children }) {
  const nonce = (await headers()).get("x-nonce");

  return (
    <html lang="zh">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#2563eb" />
        <script nonce={nonce}>
          {`
            window.addEventListener('error', (event) => {
              console.error('[Global Error Listener]', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                stack: event.error?.stack
              });
            });
            
            window.addEventListener('unhandledrejection', (event) => {
              console.error('[Unhandled Promise Rejection]', {
                reason: event.reason,
                promise: event.promise
              });
            });
          `}
        </script>
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
