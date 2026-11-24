/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // CI 只檢查 build 會不會壞，不需要 Docker 用的 standalone 打包（省約 15 秒）。
  ...(process.env.SKIP_STANDALONE ? {} : { output: 'standalone' }),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 同源可嵌入：文件預覽用同源 iframe 顯示 PDF／圖片，DENY 會讓預覽被瀏覽器擋掉。
          // 與 nginx.conf、CSP frame-ancestors 'self' 的設定一致。
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(self), camera=(self), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
