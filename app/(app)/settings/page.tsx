import SettingsView from '../../../components/SettingsView';
import { loadSnapshot } from '../../../lib/dashboard-data';
import { demoInvoices } from '../../../lib/demo';
import { DEFAULT_PROPERTY_ID, getProperty } from '../../../lib/properties';
import { DEFAULT_RATES_CONFIG } from '../../../lib/rates-config';
import { ALERT_THRESHOLDS } from '../../../lib/alerts/rules';

export const dynamic = 'force-dynamic';

/**
 * Settings is a server component so the Integrations panel can report real
 * collector health, and Notifications can quote the alert engine's actual
 * thresholds rather than restating them by hand. Tab state lives in the client
 * view it renders.
 */
export default async function Settings() {
  const { snapshot, isDemo } = await loadSnapshot();
  const property = getProperty(DEFAULT_PROPERTY_ID)!;

  return (
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
      thresholds={ALERT_THRESHOLDS}
      invoices={demoInvoices}
      isDemo={isDemo}
    />
  );
}
