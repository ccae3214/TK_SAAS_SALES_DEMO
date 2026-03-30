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
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
