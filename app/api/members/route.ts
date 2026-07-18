import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '../../../auth';
import { getStore } from '../../../lib/store';
import { listMembers, ownerEmail, saveMembers, type Role } from '../../../lib/auth/members';

export const dynamic = 'force-dynamic';

/** Team management — the invite list gating magic-link sign-in. Owner-only writes. */

const ROLES: Role[] = ['owner', 'manager', 'viewer'];

async function requireOwner() {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  if ((session.user as { role?: string }).role !== 'owner') {
    return { error: NextResponse.json({ error: 'owner role required' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const members = await listMembers(getStore());
  return NextResponse.json({ members, ownerEmail: ownerEmail() });
}

export async function POST(req: NextRequest) {
  const gate = await requireOwner();
  if (gate.error) return gate.error;

  const body = (await req.json().catch(() => ({}))) as { email?: string; role?: Role };
  const email = body.email?.trim().toLowerCase() ?? '';
  const role = body.role ?? 'viewer';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: 'role must be owner, manager, or viewer' }, { status: 400 });

  const store = getStore();
  const members = await listMembers(store);
  if (email === ownerEmail() || members.some((m) => m.email === email)) {
    return NextResponse.json({ error: 'already on the team' }, { status: 409 });
  }
  if (members.length >= 20) return NextResponse.json({ error: 'team is capped at 20 members' }, { status: 400 });

  const member = { email, role, invitedAt: new Date().toISOString() };
  await saveMembers(store, [...members, member]);
  return NextResponse.json({ ok: true, member });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireOwner();
  if (gate.error) return gate.error;

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const e = email?.trim().toLowerCase() ?? '';
  if (e === ownerEmail()) return NextResponse.json({ error: 'the OWNER_EMAIL account cannot be removed' }, { status: 400 });

  const store = getStore();
  const members = await listMembers(store);
  const remaining = members.filter((m) => m.email !== e);
  if (remaining.length === members.length) return NextResponse.json({ error: 'not on the team' }, { status: 404 });
  await saveMembers(store, remaining);
  return NextResponse.json({ ok: true });
}
