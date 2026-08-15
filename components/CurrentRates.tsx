'use client';
import { useEffect, useState } from 'react';
import type { CurrentRates } from '../lib/current-rates';
import { ReadOnlyNote, useCanWrite } from './RoleProvider';

interface Props {
  propertyId: string;
  tiers: { tierId: string; label: string }[];
}

/**
 * Owner-entered current rates. You set your prices — this is the truthful
 * "what am I charging right now", independent of whether the scraper can get
 * past your own site's bot wall today.
 */
export default function CurrentRatesCard({ propertyId, tiers }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const canWrite = useCanWrite();

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/current-rates?propertyId=${propertyId}`);
      if (!res.ok) return;
      const { rates } = (await res.json()) as { rates: CurrentRates | null };
      if (rates) {
        setValues(Object.fromEntries(Object.entries(rates.tiers).map(([k, v]) => [k, String(v)])));
        setUpdatedAt(rates.updatedAt);
      }
    })();
  }, [propertyId]);

  async function save() {
    setSaving(true);
    setStatus(null);
    const tiersBody = Object.fromEntries(
      Object.entries(values)
        .filter(([, v]) => v.trim() !== '')
        .map(([k, v]) => [k, Number(v)])
    );
    const res = await fetch(`/api/current-rates?propertyId=${propertyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiers: tiersBody }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; rates?: CurrentRates };
    if (res.ok && json.rates) {
      setUpdatedAt(json.rates.updatedAt);
      setStatus({ tone: 'ok', text: 'Saved — used as your rate in competitor comparisons.' });
    } else {
      setStatus({ tone: 'bad', text: json.error ?? 'Save failed.' });
    }
    setSaving(false);
  }

  return (
    <div className="card mb-6">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold tracking-tight">Your current rates</h3>
        {updatedAt && (
          <span className="text-xs text-muted">
            last updated {new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted">
        What you&apos;re charging right now — you set your prices, so this is the authoritative number for market
        comparisons. {canWrite ? 'Update it whenever you change rates.' : 'Only a manager can change it.'}{' '}
        (The parity monitor still cross-checks booking sites when it can.)
      </p>
      <div className="flex flex-wrap items-end gap-4">
        {tiers.map((t) => (
          <div key={t.tierId}>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">{t.label}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted">$</span>
              <input
                type="number"
                className="field w-28 px-2.5 py-1.5"
                value={values[t.tierId] ?? ''}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [t.tierId]: e.target.value }));
                  setStatus(null);
                }}
                placeholder="—"
                aria-label={`${t.label} current rate`}
                readOnly={!canWrite}
                disabled={!canWrite}
              />
            </div>
          </div>
        ))}
        {canWrite && (
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        {status && <span className={`text-sm ${status.tone === 'ok' ? 'text-ok' : 'text-bad'}`}>{status.text}</span>}
      </div>
      {!canWrite && <div className="mt-3"><ReadOnlyNote what="Changing your listed rates" /></div>}
    </div>
  );
}
