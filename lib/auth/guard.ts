import { NextResponse } from 'next/server';
import { roleAtLeast, type Role } from './roles';

export { roleAtLeast };
export type { Role };

/**
 * Server-side role enforcement.
 *
 * The middleware answers "is this person signed in?" — it cannot answer "may
 * this person change the baseline rate table?". Without the check below, an
 * invited `viewer` (front desk) could rewrite pricing config, edit the
 * competitor watchlist, and trigger collector runs. Roles are shown in
 * Settings → Team, so the server has to mean them.
 *
 * Levels and their meanings live in ./roles.
 */

export type RoleGate = { ok: true; role: Role } | { ok: false; response: NextResponse };

/**
 * Gate a route handler on a minimum role. Returns the 401/403 response to
 * early-return, so handlers stay a two-line prelude:
 *
 *   const gate = await requireRole('manager');
 *   if (!gate.ok) return gate.response;
 *
 * The session import is deferred so this module stays importable from route
 * files without hoisting NextAuth's whole graph into every one of them.
 */
export async function requireRole(required: Role): Promise<RoleGate> {
  const { auth } = await import('../../auth');
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }

  const role = ((session.user as { role?: string }).role ?? 'viewer') as Role;
  if (!roleAtLeast(role, required)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `${required} role required`, yourRole: role },
        { status: 403 }
      ),
    };
  }
  return { ok: true, role };
}
