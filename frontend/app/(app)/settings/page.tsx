import SettingsView, { type SearchBudget } from '../../../components/SettingsView';
import { loadSnapshot } from '../../../../backend/lib/dashboard-data';
import { requestProperty, requestStore } from '../../../../backend/lib/demo/context';
import { loadRatesConfig } from '../../../../backend/lib/rates-config';
import { ALERT_THRESHOLDS } from '../../../../backend/lib/alerts/rules';
import { RUN_SLOTS_CT } from '../../../../backend/collector/budget';
import { getStore } from '../../../../backend/lib/store';
import { accountFor, billingView, isExempt } from '../../../../backend/lib/billing/accounts';
import { PLAN_PRICES } from '../../../../backend/lib/billing/plans';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

/**
 * Settings is a server component so the Integrations panel can report real
 * collector health, and Notifications can quote the alert engine's actual
 * thresholds rather than restating them by hand. Tab state lives in the client
 * view it renders.
 */
export default async function Settings() {
  const { snapshot, isDemo: sample, awaitingFirstRun } = await loadSnapshot();
  // A hotel waiting on its first run is not a demo: it gets no sample sources.
  const isDemo = sample && !awaitingFirstRun;
  const property = await requestProperty();
  const rates = await loadRatesConfig(await requestStore(), property.id);
  const billing = isExempt(property.id)
    ? isDemo
      ? { plan: `Starter, ${PLAN_PRICES.starter.month} per month`, status: 'Active', canSubscribe: false, canManage: false }
      : { plan: 'Not billed', status: 'The original hotel is never billed', canSubscribe: false, canManage: false }
    : billingView(await accountFor(getStore(), property.id), new Date(), property.timezone);

  return (
    <div className="font-geist text-[#1a1b20] antialiased">
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
      billing={billing}
      isDemo={isDemo}
    />
    </div>
  );
}
