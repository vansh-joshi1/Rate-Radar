import Link from 'next/link';
import AppShell from '../../components/shell/AppShell';
import { RoleProvider } from '../../components/RoleProvider';
import { auth } from '../../auth';
import { loadSnapshot } from '../../lib/dashboard-data';
import { demoSid } from '../../lib/demo/context';
import { DEMO_PROPERTY } from '../../lib/properties';
import type { ShellProperty } from '../../components/shell/AppShell';
import type { Role } from '../../lib/auth/roles';

export const dynamic = 'force-dynamic';

/** The switcher a demo visitor sees — no real property is named anywhere in it. */
const DEMO_SWITCHER: ShellProperty[] = [
  { id: DEMO_PROPERTY.id, label: DEMO_PROPERTY.name, sub: DEMO_PROPERTY.city },
  { id: 'demo-sunrise', label: 'Sunrise Suites', sub: 'Alder Flats, OR (sample)' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const inDemo = demoSid() !== null;
  const [{ snapshot, isDemo }, session] = await Promise.all([loadSnapshot(), inDemo ? null : auth()]);
  const mins = Math.max(0, Math.round((Date.now() - new Date(snapshot.runAt).getTime()) / 60_000));
  const freshness = isDemo
    ? 'Sample data — run the collector to go live'
    : `Data fresh as of ${mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`} ago`;
  // A demo visitor owns their sandbox outright, so every control is live for
  // them — that is the point of the demo. The role is real; its reach is not.
  const role = inDemo
    ? ('owner' as Role)
    : (((session?.user as { role?: string } | undefined)?.role ?? 'viewer') as Role);
  const user = inDemo
    ? { name: 'Demo visitor', email: undefined, role: 'owner' }
    : session?.user
      ? {
          name: session.user.name ?? session.user.email ?? 'Signed in',
          email: session.user.email ?? undefined,
          role: role as string,
        }
      : null;
  // Drives the notification dot in the top bar — real collector health, not decoration.
  const alerts = snapshot.sources.filter((s) => s.status !== 'ok').length;
  return (
    <RoleProvider role={role}>
      <AppShell
        freshness={freshness}
        user={user}
        alerts={alerts}
        properties={inDemo ? DEMO_SWITCHER : undefined}
        isDemo={inDemo}
      >
        {inDemo && <DemoBar />}
        {children}
      </AppShell>
    </RoleProvider>
  );
}

/**
 * Standing notice for a demo sandbox. It says the two things a visitor needs
 * and neither of them is "welcome": the numbers are invented, and the edits
 * are theirs alone. Persistent rather than dismissible — someone who lands
 * here from a link should never have to wonder which mode they are in.
 */
function DemoBar() {
  return (
    <div className="mb-lg flex flex-col gap-sm rounded-lg border border-accent/30 bg-accent/5 p-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-sm">
        <span className="material-symbols-outlined mt-px shrink-0 text-accent" aria-hidden>
          science
        </span>
        <p className="font-body-md text-body-md text-ink">
          <strong>Demo sandbox.</strong> Harbor Pine Inn is an invented hotel in an invented town, and every
          rate, competitor and event below is sample data. Everything is editable — your changes live only in
          your own sandbox and clear themselves after a day.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-sm">
        <Link href="/demo?reset=1" className="btn btn-sm">
          Reset
        </Link>
        <Link href="/demo/exit" className="btn btn-sm">
          Exit demo
        </Link>
      </div>
    </div>
  );
}
