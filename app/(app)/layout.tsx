import AppShell from '../../components/shell/AppShell';
import { loadSnapshot } from '../../lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { snapshot, isDemo } = await loadSnapshot();
  const mins = Math.max(0, Math.round((Date.now() - new Date(snapshot.runAt).getTime()) / 60_000));
  const freshness = isDemo
    ? 'Sample data — run the collector to go live'
    : `Data fresh as of ${mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`} ago`;
  return <AppShell freshness={freshness}>{children}</AppShell>;
}
