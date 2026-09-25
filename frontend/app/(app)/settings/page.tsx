import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import SettingsView, { type SearchBudget } from '../../../components/SettingsView';
import { loadSnapshot } from '../../../../backend/lib/dashboard-data';
import { demoInvoices } from '../../../../backend/lib/demo';
import { requestProperty } from '../../../../backend/lib/demo/context';
import { DEFAULT_RATES_CONFIG } from '../../../../backend/lib/rates-config';
import { ALERT_THRESHOLDS } from '../../../../backend/lib/alerts/rules';

export const dynamic = 'force-dynamic';

/**
 * Settings is a server component so the Integrations panel can report real
 * collector health, and Notifications can quote the alert engine's actual
 * thresholds rather than restating them by hand. Tab state lives in the client
 * view it renders.
 */
export default async function Settings() {
  const { snapshot, isDemo } = await loadSnapshot();
  const property = requestProperty();

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} font-geist text-[#1a1b20] antialiased`}>
    <SettingsView
      property={{
        id: property.id,
        name: property.name,
        city: property.city,
        timezone: property.timezone,
        lat: property.lat,
        lng: property.lng,
      }}
      tiers={DEFAULT_RATES_CONFIG.tiers.map((t) => ({ tierId: t.id, label: t.label }))}
      sources={snapshot.sources.map((s) => ({
        source: s.source,
        status: s.status,
        error: s.error,
        fetchedAt: s.fetchedAt,
      }))}
      budget={
        (snapshot.sources.find((s) => s.source === 'rates')?.data as { budget?: SearchBudget } | undefined)?.budget
      }
      thresholds={ALERT_THRESHOLDS}
      invoices={demoInvoices}
      isDemo={isDemo}
    />
    </div>
  );
}
