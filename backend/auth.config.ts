import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

/**
 * Edge-safe Auth.js config — imported by the middleware, so nothing here may
 * touch the store/filesystem. The full config (adapter + email provider)
 * lives in auth.ts.
 *
 * Credentials = the shared site password: the family's zero-setup path,
 * mapped to a shared owner identity. Magic-link users get personal identities.
 */
export default {
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 3600 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      id: 'site-password',
      name: 'Site password',
      credentials: { password: { label: 'Password', type: 'password' } },
      authorize(credentials) {
        const expected = process.env.SITE_PASSWORD;
        if (!expected || credentials?.password !== expected) return null;
        return { id: 'shared-owner', name: 'Front desk (shared password)', email: null, role: 'owner' };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? 'viewer';
        token.name = user.name ?? token.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = (token.role as string) ?? 'viewer';
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
