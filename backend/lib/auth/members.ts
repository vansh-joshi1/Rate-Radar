import type { Store } from '../store';
import type { Role } from './roles';
import { DEFAULT_PROPERTY_ID } from '../properties';

/**
 * Invite list — who may sign in, which hotel they belong to, and their role
 * there. This gate is what keeps a real hotel's dashboard from being open to
 * any stranger who finds the signup page. The OWNER_EMAIL env var is always
 * allowed (bootstrap), even with an empty list.
 *
 * One global list, because sign-in looks a person up by email before it knows
 * their hotel. Each member belongs to exactly one property; a role means
 * "at that property" and nowhere else.
 */

export type { Role };

export interface Member {
  email: string;
  role: Role;
  invitedAt: string;
  /** Absent on members invited before hotels were separated: they are the original property's. */
  propertyId?: string;
}

export interface Membership {
  role: Role;
  propertyId: string;
}

const KEY = 'auth:members';

export function ownerEmail(): string | null {
  return process.env.OWNER_EMAIL?.trim().toLowerCase() || null;
}

export const memberProperty = (m: Member): string => m.propertyId ?? DEFAULT_PROPERTY_ID;

export async function listMembers(store: Store): Promise<Member[]> {
  return (await store.get<Member[]>(KEY)) ?? [];
}

export async function saveMembers(store: Store, members: Member[]): Promise<void> {
  await store.set(KEY, members);
}

/** OWNER_EMAIL owns the original property and approves new ones (see /admin). */
export async function membershipFor(store: Store, email: string): Promise<Membership | null> {
  const e = email.trim().toLowerCase();
  if (e && e === ownerEmail()) return { role: 'owner', propertyId: DEFAULT_PROPERTY_ID };
  const member = (await listMembers(store)).find((m) => m.email === e);
  return member ? { role: member.role, propertyId: memberProperty(member) } : null;
}

export async function roleFor(store: Store, email: string): Promise<Role | null> {
  return (await membershipFor(store, email))?.role ?? null;
}

export async function isAllowed(store: Store, email: string): Promise<boolean> {
  return (await membershipFor(store, email)) !== null;
}
