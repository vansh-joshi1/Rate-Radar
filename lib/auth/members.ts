import type { Store } from '../store';

/**
 * Invite list — who may sign in with an email magic link, and their role.
 * This gate is what keeps a real hotel's dashboard from being open to any
 * stranger who finds the signup page. The OWNER_EMAIL env var is always
 * allowed (bootstrap), even with an empty list.
 */

export type Role = 'owner' | 'manager' | 'viewer';

export interface Member {
  email: string;
  role: Role;
  invitedAt: string;
}

const KEY = 'auth:members';

export function ownerEmail(): string | null {
  return process.env.OWNER_EMAIL?.trim().toLowerCase() || null;
}

export async function listMembers(store: Store): Promise<Member[]> {
  return (await store.get<Member[]>(KEY)) ?? [];
}

export async function saveMembers(store: Store, members: Member[]): Promise<void> {
  await store.set(KEY, members);
}

export async function roleFor(store: Store, email: string): Promise<Role | null> {
  const e = email.trim().toLowerCase();
  if (e && e === ownerEmail()) return 'owner';
  const member = (await listMembers(store)).find((m) => m.email === e);
  return member?.role ?? null;
}

export async function isAllowed(store: Store, email: string): Promise<boolean> {
  return (await roleFor(store, email)) !== null;
}
