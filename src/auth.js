import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import LINE from "next-auth/providers/line";
import Credentials from "next-auth/providers/credentials";
import { get } from '@/lib/db';
import { verifyPassword } from '@/lib/passwords';

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
    try {
      const member = await get(`SELECT id,email,display_name,password_hash,active
        FROM hr_members WHERE lower(email)=$1`, [email]);
      if (!member?.active || !member.password_hash || !await verifyPassword(password, member.password_hash)) return null;
      return { id: String(member.id), email: member.email, name: member.display_name };
    } catch (error) {
      console.error('hr_member_sign_in_failed', error?.name || 'Error');
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
      // Keep iOS LINE Login in the browser that started OAuth. Auto-login can
      // hand the callback to a different browser, which cannot return Auth.js state cookies.
      authorization: { params: { scope: "openid profile", disable_auto_login: "true" } },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "line") {
        token.lineUserId = profile?.sub || token.sub;
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
