import AppShell from '../../components/shell/AppShell';
import { RoleProvider } from '../../components/RoleProvider';
import { auth } from '../../auth';
import { loadSnapshot } from '../../lib/dashboard-data';
import type { Role } from '../../lib/auth/roles';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ snapshot, isDemo }, session] = await Promise.all([loadSnapshot(), auth()]);
  const mins = Math.max(0, Math.round((Date.now() - new Date(snapshot.runAt).getTime()) / 60_000));
  const freshness = isDemo
    ? 'Sample data — run the collector to go live'
    : `Data fresh as of ${mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`} ago`;
  const role = ((session?.user as { role?: string } | undefined)?.role ?? 'viewer') as Role;
  const user = session?.user
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
      <AppShell freshness={freshness} user={user} alerts={alerts}>
        {children}
      </AppShell>
    </RoleProvider>
  );
}
