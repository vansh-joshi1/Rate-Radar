import AppShell from '../../components/shell/AppShell';
import { auth } from '../../auth';
import { loadSnapshot } from '../../lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ snapshot, isDemo }, session] = await Promise.all([loadSnapshot(), auth()]);
  const mins = Math.max(0, Math.round((Date.now() - new Date(snapshot.runAt).getTime()) / 60_000));
  const freshness = isDemo
    ? 'Sample data — run the collector to go live'
    : `Data fresh as of ${mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`} ago`;
  const user = session?.user
    ? {
        name: session.user.name ?? session.user.email ?? 'Signed in',
        email: session.user.email ?? undefined,
        role: ((session.user as { role?: string }).role ?? 'viewer') as string,
      }
    : null;
  return (
    <AppShell freshness={freshness} user={user}>
      {children}
    </AppShell>
  );
}
