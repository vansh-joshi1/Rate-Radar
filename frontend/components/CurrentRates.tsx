'use client';
import { useEffect, useState } from 'react';
import { track } from './PostHogInit';
import { CheckIcon } from '@phosphor-icons/react/dist/ssr/Check';
import type { CurrentRates } from '../../backend/lib/current-rates';
import { ReadOnlyNote, useCanWrite } from './RoleProvider';
import { PillButton } from './landing/Machined';
import { FIELD, FIELD_BAD, NUMBER, MONO_LABEL, StatusLine } from './settings/parts';

interface Props {
  propertyId: string;
  tiers: { tierId: string; label: string }[];
}

/**
 * Owner-entered current rates. You set your prices, so this is the truthful
 * "what am I charging right now", independent of whether the scraper can get
 * past your own site's bot wall today. Renders inside the Settings panel that
 * titles it; it has no card of its own.
 */
export default function CurrentRatesCard({ propertyId, tiers }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const canWrite = useCanWrite();

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/current-rates?propertyId=${propertyId}`).catch(() => null);
      if (!res?.ok) return;
      const { rates } = (await res.json()) as { rates: CurrentRates | null };
      if (rates) {
        const next = Object.fromEntries(Object.entries(rates.tiers).map(([k, v]) => [k, String(v)]));
        setValues(next);
        setSaved(next);
        setUpdatedAt(rates.updatedAt);
      }
    })();
  }, [propertyId]);

  // A blank field means "not set"; anything typed must be a real price.
  const bad = (v: string | undefined) => v != null && v.trim() !== '' && !(Number(v) > 0);
  const invalid = tiers.some((t) => bad(values[t.tierId]));
  const dirty = tiers.some((t) => (values[t.tierId] ?? '') !== (saved[t.tierId] ?? ''));

  async function save() {
    if (invalid) return;
    setSaving(true);
    setStatus(null);
    const tiersBody = Object.fromEntries(
      Object.entries(values)
        .filter(([, v]) => v.trim() !== '')
        .map(([k, v]) => [k, Number(v)]),
    );
    try {
      const res = await fetch(`/api/current-rates?propertyId=${propertyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers: tiersBody }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; rates?: CurrentRates };
      if (res.ok && json.rates) {
        setUpdatedAt(json.rates.updatedAt);
        setSaved(values);
        track('current_rates_saved', { configured_tier_count: Object.keys(tiersBody).length });
        setStatus({ tone: 'ok', text: 'Saved. Competitor comparisons now use these as your rates.' });
      } else {
        setStatus({ tone: 'bad', text: json.error ?? 'Your rates were not saved. Try again.' });
      }
    } catch {
      setStatus({ tone: 'bad', text: 'Could not reach the server, so nothing was saved. Check your connection.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="max-w-[64ch] text-pretty text-[14.5px] leading-relaxed text-[#44474d]">
        What you are charging right now. You set your prices, so this is the number market comparisons trust.{' '}
        {canWrite ? 'Update it whenever you change rates.' : 'Only a manager can change it.'} The parity monitor still
        cross-checks every channel selling you.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {tiers.map((t) => {
          const v = values[t.tierId];
          const isBad = bad(v);
          return (
            <div key={t.tierId} className="rounded-[1rem] bg-[#0b1c30]/[0.035] px-4 py-3.5">
              <label htmlFor={`rate-${t.tierId}`} className="block text-[14.5px] font-medium">
                {t.label.split(' (')[0]}
              </label>
              <div className="relative mt-2 max-w-[11rem]">
                <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-[#44474d]">
                  $
                </span>
                <input
                  id={`rate-${t.tierId}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className={`${FIELD} ${NUMBER} pl-8 tabular-nums ${isBad ? FIELD_BAD : ''}`}
                  value={v ?? ''}
                  onChange={(e) => {
                    setValues((prev) => ({ ...prev, [t.tierId]: e.target.value }));
                    setStatus(null);
                  }}
                  placeholder="Not set"
                  aria-invalid={isBad || undefined}
                  disabled={!canWrite}
                />
              </div>
              {isBad && <p className="mt-1.5 text-[12.5px] text-[#b45309]">Enter a price above $0, or leave it blank.</p>}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {canWrite ? (
          <PillButton
            onClick={save}
            disabled={saving || !dirty || invalid}
            icon={<CheckIcon weight="light" className="h-4 w-4" />}
          >
            {saving ? 'Saving' : 'Save rates'}
          </PillButton>
        ) : (
          <ReadOnlyNote what="Changing your listed rates" />
        )}
        {updatedAt && !status && (
          <span className={`${MONO_LABEL} tabular-nums`}>
            Last updated {new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        <StatusLine status={status} />
      </div>
    </div>
  );
}
