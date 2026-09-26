import { z } from 'zod';
import type { Store } from './store';
import { passwordOk } from './password';

/**
 * Access requests: what /onboarding collects, saved for OWNER_EMAIL to review
 * and approve at /admin (onboarding is sales-assisted, PRODUCT.md). One hash, keyed
 * by email, so a field write is atomic and a re-request overwrites cleanly.
 *
 * The password is NOT here: it goes straight to Supabase Auth, which hashes it.
 */

const KEY = 'onboarding:requests';

const url = z.string().trim().url().max(500).or(z.literal(''));

export const AccessRequestBody = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().max(72).refine(passwordOk, 'password does not meet the rules'),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((p) => p.replace(/\D/g, '').length >= 10, 'phone needs at least 10 digits'),
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(200),
  rooms: z.coerce.number().int().min(1).max(5000),
  type: z.enum(['Hotel', 'Motel', 'Inn']),
  /** Google Hotels property_token of the confirmed match, if discovery found one. */
  token: z.string().max(200).nullable(),
  channels: z.array(z.string().max(120)).max(60),
  listings: z.object({ direct: url, expedia: url, booking: url }),
  roomTypes: z
    .array(z.object({ name: z.string().max(200), tier: z.enum(['standard', 'superior']), price: z.number().nullable() }))
    .max(60),
  competitors: z.array(z.string().trim().min(1).max(120)).min(1).max(40),
});

export type AccessRequest = Omit<z.infer<typeof AccessRequestBody>, 'password'> & {
  status: 'pending' | 'approved';
  /** Set when approval starts, so a retry after a partial failure finishes the same hotel instead of making another. */
  propertyId?: string;
  submittedAt: string;
};

export async function saveAccessRequest(store: Store, req: AccessRequest): Promise<void> {
  await store.hset(KEY, req.email, req);
}

export async function getAccessRequest(store: Store, email: string): Promise<AccessRequest | null> {
  return store.hget<AccessRequest>(KEY, email.trim().toLowerCase());
}

/** Every request, newest first. */
export async function listAccessRequests(store: Store): Promise<AccessRequest[]> {
  const all = Object.values(await store.hgetall<AccessRequest>(KEY));
  return all.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
