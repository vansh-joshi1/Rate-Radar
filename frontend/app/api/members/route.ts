import { NextResponse, type NextRequest } from 'next/server';
import { auth, revokeUser } from '../../../../backend/auth';
import { requestStore, demoSid } from '../../../../backend/lib/demo/context';
import { getStore, type Store } from '../../../../backend/lib/store';
import { DEFAULT_PROPERTY_ID } from '../../../../backend/lib/properties';
import { listMembers, memberProperty, ownerEmail, saveMembers, type Member, type Role } from '../../../../backend/lib/auth/members';
import { requireRole } from '../../../../backend/lib/auth/guard';

export const dynamic = 'force-dynamic';

/**
 * Team management — the invite list gating sign-in. Owner-only writes.
 *
 * The list is global (sign-in finds a person by email), but every caller sees
 * and edits only the members of their own hotel. An email can belong to one
 * hotel at a time.
 */

const ROLES: Role[] = ['owner', 'manager', 'viewer'];

/** The invented owner of the invented hotel. */
const DEMO_OWNER_EMAIL = 'owner@harborpineinn.example';

interface Team {
  store: Store;
  propertyId: string;
  /** Whether a member belongs to this team. A sandbox's list is its team outright. */
  mine: (m: Member) => boolean;
  /** The bootstrap owner shown (and protected) on this team, if it has one. */
  owner: string | null;
}

/**
 * OWNER_EMAIL is a real person's address and owns the original property. The
 * demo shows a team panel, so it gets a fictional owner instead. Adding a
 * teammate sends nothing: invites are a store-backed allow-list, and mail goes
 * out only when that person later requests a sign-in link.
 */
async function team(): Promise<Team | null> {
  if (demoSid()) {
    return { store: await requestStore(), propertyId: '', mine: () => true, owner: DEMO_OWNER_EMAIL };
  }
  const session = await auth();
  if (!session?.user) return null;
  const { propertyId } = session.user;
  return {
    store: getStore(),
    propertyId,
    mine: (m) => memberProperty(m) === propertyId,
    owner: propertyId === DEFAULT_PROPERTY_ID ? ownerEmail() : null,
  };
}

const unauthorized = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });

export async function GET() {
  const t = await team();
  if (!t) return unauthorized();
  const members = (await listMembers(t.store)).filter(t.mine);
  return NextResponse.json({ members, ownerEmail: t.owner });
}

export async function POST(req: NextRequest) {
  const gate = await requireRole('owner');
  if (!gate.ok) return gate.response;
  const t = await team();
  if (!t) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as { email?: string; role?: Role };
  const email = body.email?.trim().toLowerCase() ?? '';
  const role = body.role ?? 'viewer';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: 'role must be owner, manager, or viewer' }, { status: 400 });

  const members = await listMembers(t.store);
  const existing = members.find((m) => m.email === email);
  if (email === t.owner || (existing && t.mine(existing))) {
    return NextResponse.json({ error: 'already on the team' }, { status: 409 });
  }
  // Also refuses OWNER_EMAIL from another hotel's team: it owns the original property.
  if (existing || email === ownerEmail()) {
    return NextResponse.json({ error: 'that email already belongs to another hotel' }, { status: 409 });
  }
  if (members.filter(t.mine).length >= 20) return NextResponse.json({ error: 'team is capped at 20 members' }, { status: 400 });

  const member: Member = { email, role, invitedAt: new Date().toISOString(), ...(t.propertyId ? { propertyId: t.propertyId } : {}) };
  await saveMembers(t.store, [...members, member]);
  return NextResponse.json({ ok: true, member });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireRole('owner');
  if (!gate.ok) return gate.response;
  const t = await team();
  if (!t) return unauthorized();

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const e = email?.trim().toLowerCase() ?? '';
  if (e === t.owner) return NextResponse.json({ error: 'the OWNER_EMAIL account cannot be removed' }, { status: 400 });

  const members = await listMembers(t.store);
  const remaining = members.filter((m) => !(m.email === e && t.mine(m)));
  if (remaining.length === members.length) return NextResponse.json({ error: 'not on the team' }, { status: 404 });
  // A hotel with no fixed OWNER_EMAIL depends on its listed owners: removing the
  // last one would leave nobody to manage the team and nobody to receive alerts.
  if (!t.owner && !remaining.some((m) => t.mine(m) && m.role === 'owner')) {
    return NextResponse.json({ error: 'a hotel needs at least one owner. Invite another owner first.' }, { status: 400 });
  }
  await saveMembers(t.store, remaining);
  // A sandbox's team is fictional; only a real removal has sessions to kill.
  if (!demoSid()) await revokeUser(e);
  return NextResponse.json({ ok: true });
}
