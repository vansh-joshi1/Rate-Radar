import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import SettingsView, { type SearchBudget } from '../../../components/SettingsView';
import { loadSnapshot } from '../../../../backend/lib/dashboard-data';
import { demoInvoices } from '../../../../backend/lib/demo';
import { requestProperty, requestStore } from '../../../../backend/lib/demo/context';
import { loadRatesConfig } from '../../../../backend/lib/rates-config';
import { ALERT_THRESHOLDS } from '../../../../backend/lib/alerts/rules';
import { RUN_SLOTS_CT } from '../../../../backend/collector/budget';

export const dynamic = 'force-dynamic';

/**
 * Settings is a server component so the Integrations panel can report real
 * collector health, and Notifications can quote the alert engine's actual
 * thresholds rather than restating them by hand. Tab state lives in the client
 * view it renders.
 */
export default async function Settings() {
  const { snapshot, isDemo: sample, awaitingFirstRun } = await loadSnapshot();
  // A hotel waiting on its first run is not a demo: it gets no sample sources or invoices.
  const isDemo = sample && !awaitingFirstRun;
  const property = await requestProperty();
  const rates = await loadRatesConfig(await requestStore(), property.id);

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
      tiers={rates.tiers.map((t) => ({ tierId: t.id, label: t.label }))}
      sources={(awaitingFirstRun ? [] : snapshot.sources).map((s) => ({
        source: s.source,
        status: s.status,
        error: s.error,
        fetchedAt: s.fetchedAt,
      }))}
      budget={
        awaitingFirstRun
          ? undefined
          : (snapshot.sources.find((s) => s.source === 'rates')?.data as { budget?: SearchBudget } | undefined)?.budget
      }
      thresholds={ALERT_THRESHOLDS}
      runSlots={RUN_SLOTS_CT}
      invoices={isDemo ? demoInvoices : []}
      isDemo={isDemo}
    />
    </div>
  );
}
