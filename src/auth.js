import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import LINE from "next-auth/providers/line";
import Credentials from "next-auth/providers/credentials";
import { get } from '@/lib/db';
import { verifyPassword } from '@/lib/passwords';
import { isLoginLocked, recordLoginFailure, clearLoginFailures } from '@/lib/login-rate-limit';
import { consumeHandoff } from '@/lib/hr-line-handoff-store';

const providers = [];

providers.push(Credentials({
  id: 'credentials',
  name: 'Email 與密碼',
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: '密碼', type: 'password' },
  },
  async authorize(credentials) {
    const email = String(credentials?.email || '').trim().toLowerCase();
    const password = String(credentials?.password || '');
    if (!email || !password) return null;
    // 同一個 email 連續輸錯太多次就暫時拒絕登入（連密碼都不比對）。
    if (isLoginLocked(email)) return null;
    try {
      const member = await get(`SELECT id,email,display_name,password_hash,active
        FROM hr_members WHERE lower(email)=$1`, [email]);
      if (!member?.active || !member.password_hash || !await verifyPassword(password, member.password_hash)) {
        recordLoginFailure(email);
        return null;
      }
      clearLoginFailures(email);
      return { id: String(member.id), email: member.email, name: member.display_name };
    } catch (error) {
      console.error('hr_member_sign_in_failed', error?.name || 'Error');
      return null;
    }
  },
}));

// 桌面 App（PWA）的 LINE 登入：LINE 驗證在外部瀏覽器完成（見 /api/hr/line-handoff/*），
// App 輸入確認碼後在這裡換成登入憑證。App 與外部瀏覽器的 cookie 不互通，所以不能用上面的 line provider。
providers.push(Credentials({
  id: 'line-handoff',
  name: 'LINE（桌面 App）',
  credentials: {
    state: { type: 'text' },
    secret: { type: 'text' },
    code: { type: 'text' },
  },
  async authorize(credentials) {
    try {
      const identity = await consumeHandoff({
        state: String(credentials?.state || ''),
        secret: String(credentials?.secret || ''),
        code: String(credentials?.code || ''),
      });
      if (!identity) return null;
      return { id: identity.lineUserId, name: identity.displayName || null, lineUserId: identity.lineUserId };
    } catch (error) {
      console.error('hr_line_handoff_sign_in_failed', error?.name || 'Error');
      return null;
    }
  },
}));

// Only add Google provider if credentials are configured
if (process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      issuer: process.env.OIDC_ISSUER,
    })
  );
}

// LINE Login credentials belong to a LINE Login channel in LINE Developers.
if (process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET) {
  providers.push(
    LINE({
      clientId: process.env.LINE_LOGIN_CHANNEL_ID,
      clientSecret: process.env.LINE_LOGIN_CHANNEL_SECRET,
      // 預設啟用 LINE 自動登入：手機上會跳到 LINE App 完成認證，不必輸入 LINE 帳號密碼。
      // 若自動登入失敗（例如 iOS 的 Universal Link 沒生效、隱私瀏覽），登入頁會提示使用者
      // 改用 disable_auto_login=true 重試，做法依照 LINE 官方 "How to handle auto login failure"。
      authorization: { params: { scope: "openid profile" } },
    })
  );
}

// 這次登入的 LINE User ID：一般 LINE 登入，或桌面 App 的 LINE 交接登入。
function signInLineUserId({ user, account, profile }) {
  if (account?.provider === "line") return profile?.sub || account.providerAccountId || null;
  if (account?.provider === "line-handoff") return user?.lineUserId || null;
  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: {
    // 登入失敗（含 LINE 自動登入失敗造成的 state 不符）時回到登入頁，由登入頁提示重試
    error: "/hr/login",
  },
  session: {
    strategy: "jwt",
    // 登入憑證 8 小時後失效，必須重新登入；updateAge 等於 maxAge，不會因為一直在用而自動延長。
    maxAge: 8 * 60 * 60,
    updateAge: 8 * 60 * 60,
  },
  events: {
    // 會員審核通過後「第一次登入」時，用 LINE 發一則歡迎訊息（只發一次；失敗不影響登入）。
    async signIn({ user, account, profile }) {
      try {
        const lineUserId = signInLineUserId({ user, account, profile });
        const { welcomeAfterFirstLogin } = await import('@/lib/hr-first-login');
        void welcomeAfterFirstLogin({ lineUserId, email: user?.email || null })
          .catch((error) => console.error('hr_first_login_welcome_failed', error?.message || 'Error'));
      } catch (error) {
        console.error('hr_first_login_welcome_failed', error?.message || 'Error');
      }
      try {
        // 工人會員的活動紀錄：記一筆登入（只記工作者會員；失敗不影響登入）。
        const lineUserId = signInLineUserId({ user, account, profile });
        const { recordWorkerLogin } = await import('@/lib/hr-worker-log');
        void recordWorkerLogin({ lineUserId, email: user?.email || null });
      } catch (error) {
        console.error('hr_worker_log_login_failed', error?.message || 'Error');
      }
    },
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "line") {
        token.lineUserId = profile?.sub || token.sub;
      } else if (account?.provider === "line-handoff" && user?.lineUserId) {
        token.lineUserId = user.lineUserId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.lineUserId) {
        session.user.lineUserId = token.lineUserId;
      }
      return session;
    },
    // 登入/登出後一律回到本站首頁，避免被導去其他頁面或外部網址
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {}
      return baseUrl;
    },
    authorized({ request }) {
      return !!request.auth;
    }
  }
});
