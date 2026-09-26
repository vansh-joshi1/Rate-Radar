import { FlaskIcon } from '@phosphor-icons/react/dist/ssr/Flask';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/ssr/ArrowCounterClockwise';
import { PillCta } from '../../components/landing/Machined';
import AppShell from '../../components/shell/AppShell';
import AwaitingFirstRun from '../../components/AwaitingFirstRun';
import { RoleProvider } from '../../components/RoleProvider';
import PostHogInit from '../../components/PostHogInit';
import { redirect } from 'next/navigation';
import { auth } from '../../../backend/auth';
import { loadSnapshot } from '../../../backend/lib/dashboard-data';
import { demoSid, requestProperty } from '../../../backend/lib/demo/context';
import { DEMO_PROPERTY } from '../../../backend/lib/properties';
import type { ShellProperty } from '../../components/shell/AppShell';
import type { Role } from '../../../backend/lib/auth/roles';

export const dynamic = 'force-dynamic';

/** The switcher a demo visitor sees — no real property is named anywhere in it. */
const DEMO_SWITCHER: ShellProperty[] = [
  { id: DEMO_PROPERTY.id, label: DEMO_PROPERTY.name, sub: DEMO_PROPERTY.city },
  { id: 'demo-sunrise', label: 'Sunrise Suites', sub: 'Alder Flats, OR (sample)' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const inDemo = demoSid() !== null;
  const [{ snapshot, isDemo, awaitingFirstRun }, session] = await Promise.all([loadSnapshot(), inDemo ? null : auth()]);
  // Signed in to Supabase but no longer on the team: the middleware can't know that, auth() does.
  if (!inDemo && !session) redirect('/login');
  const property = inDemo ? null : await requestProperty();
  const mins = Math.max(0, Math.round((Date.now() - new Date(snapshot.runAt).getTime()) / 60_000));
  const freshness = awaitingFirstRun
    ? 'Waiting for the first collection'
    : isDemo
      ? 'Sample data. Run the collector to go live'
      : `Data fresh as of ${mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`} ago`;
  // A demo visitor owns their sandbox outright, so every control is live for
  // them — that is the point of the demo. The role is real; its reach is not.
  const role = inDemo
    ? ('owner' as Role)
    : (session?.user.role ?? 'viewer');
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
  const alerts = awaitingFirstRun ? 0 : snapshot.sources.filter((s) => s.status !== 'ok').length;
  return (
    <RoleProvider role={role}>
      {!inDemo && session && (
        <PostHogInit
          distinctId={session.user.id}
          email={session.user.email ?? undefined}
          name={session.user.name ?? undefined}
          role={session.user.role}
        />
      )}
      <AppShell
        freshness={freshness}
        user={user}
        alerts={alerts}
        properties={property ? [{ id: property.id, label: property.name, sub: property.city }] : DEMO_SWITCHER}
        showPortfolio={inDemo || Boolean(session?.user.isAdmin)}
        isDemo={inDemo}
      >
        {inDemo && <DemoBar />}
        {awaitingFirstRun && property ? <AwaitingFirstRun hotel={property.name}>{children}</AwaitingFirstRun> : children}
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
    <div className="flex flex-col gap-4 rounded-[1.25rem] bg-[#0b1c30]/[0.04] px-5 py-4 font-geist text-[#1a1b20] antialiased ring-1 ring-[#0b1c30]/[0.06] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <FlaskIcon weight="light" className="mt-0.5 h-5 w-5 shrink-0 text-[#44474d]" aria-hidden />
        <p className="max-w-[80ch] text-[14.5px] leading-relaxed text-[#44474d]">
          <span className="font-semibold text-[#1a1b20]">Demo sandbox.</span> Harbor Pine Inn is an invented hotel in
          an invented town, and every rate, competitor and event here is sample data. Edit anything: changes stay in
          your own sandbox and clear after a day.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <PillCta href="/demo?reset=1" variant="secondary" size="sm" icon={<ArrowCounterClockwiseIcon weight="light" className="h-3.5 w-3.5" />}>
          Reset
        </PillCta>
        <PillCta href="/demo/exit" variant="secondary" size="sm">
          Exit demo
        </PillCta>
      </div>
    </div>
  );
}
