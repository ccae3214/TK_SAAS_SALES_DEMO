import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const providers = [];

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ request }) {
      return !!request.auth;
    }
  }
});
