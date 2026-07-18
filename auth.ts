import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import authConfig from './auth.config';
import { getStore } from './lib/store';
import { storeAdapter } from './lib/auth/adapter';
import { isAllowed, roleFor } from './lib/auth/members';

/**
 * Full Auth.js setup (node runtime — API routes and server components).
 *
 * Two ways in:
 *  - shared site password (credentials, defined in auth.config.ts)
 *  - email magic link via Resend — INVITE-GATED: only OWNER_EMAIL and
 *    addresses on the Team list may sign in. Free-tier Resend only delivers
 *    to the Resend account owner's address until a domain is verified.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: storeAdapter(getStore()),
  providers: [
    ...authConfig.providers,
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: 'Rate Radar <onboarding@resend.dev>',
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider !== 'resend') return true; // password path self-validates
      const email = user.email;
      if (!email) return false;
      return isAllowed(getStore(), email);
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.name = user.name ?? token.name;
        if (account?.provider === 'resend' && user.email) {
          token.role = (await roleFor(getStore(), user.email)) ?? 'viewer';
        } else {
          token.role = (user as { role?: string }).role ?? 'viewer';
        }
      }
      return token;
    },
  },
});
