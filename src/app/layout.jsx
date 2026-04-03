import "./globals.css";
import "../App.css";
import Providers from "./providers";

export const metadata = {
  title: "TK SaaS Sales Demo - NEXT EDITION",
  description: "Advanced SaaS Platform Demo with PWA & OIDC",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TK SaaS",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <meta name="theme-color" content="#2563eb" />
        <script>
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
