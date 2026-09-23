import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '../../../auth';
import { requestStore, demoSid } from '../../../lib/demo/context';
import { listMembers, ownerEmail, saveMembers, type Role } from '../../../lib/auth/members';
import { requireRole } from '../../../lib/auth/guard';

export const dynamic = 'force-dynamic';

/** Team management — the invite list gating magic-link sign-in. Owner-only writes. */

const ROLES: Role[] = ['owner', 'manager', 'viewer'];

/** The invented owner of the invented hotel. */
const DEMO_OWNER_EMAIL = 'owner@harborpineinn.example';

/**
 * OWNER_EMAIL is a real person's address. The demo shows a team panel, so it
 * needs an owner to show — it gets a fictional one. Adding a teammate here
 * sends nothing: invites are a store-backed allow-list, and mail goes out only
 * when that person later requests a sign-in link.
 */
function effectiveOwnerEmail(): string | null {
  return demoSid() ? DEMO_OWNER_EMAIL : ownerEmail();
}

export async function GET() {
  // A demo sandbox has no session but does have a (fictional) team to show.
  if (!demoSid()) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const members = await listMembers(requestStore());
  return NextResponse.json({ members, ownerEmail: effectiveOwnerEmail() });
}

export async function POST(req: NextRequest) {
  const gate = await requireRole('owner');
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => ({}))) as { email?: string; role?: Role };
  const email = body.email?.trim().toLowerCase() ?? '';
  const role = body.role ?? 'viewer';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: 'role must be owner, manager, or viewer' }, { status: 400 });

  const store = requestStore();
  const members = await listMembers(store);
  if (email === effectiveOwnerEmail() || members.some((m) => m.email === email)) {
    return NextResponse.json({ error: 'already on the team' }, { status: 409 });
  }
  if (members.length >= 20) return NextResponse.json({ error: 'team is capped at 20 members' }, { status: 400 });

  const member = { email, role, invitedAt: new Date().toISOString() };
  await saveMembers(store, [...members, member]);
  return NextResponse.json({ ok: true, member });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireRole('owner');
  if (!gate.ok) return gate.response;

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const e = email?.trim().toLowerCase() ?? '';
  if (e === effectiveOwnerEmail()) return NextResponse.json({ error: 'the OWNER_EMAIL account cannot be removed' }, { status: 400 });

  const store = requestStore();
  const members = await listMembers(store);
  const remaining = members.filter((m) => m.email !== e);
  if (remaining.length === members.length) return NextResponse.json({ error: 'not on the team' }, { status: 404 });
  await saveMembers(store, remaining);
  return NextResponse.json({ ok: true });
}
