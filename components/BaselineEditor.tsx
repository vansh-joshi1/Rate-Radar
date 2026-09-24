'use client';
import { useEffect, useMemo, useState } from 'react';
import type { DayRange, RatesConfig } from '../lib/rates-config';
import { ReadOnlyNote, useCanWrite } from './RoleProvider';
import { CheckIcon } from '@phosphor-icons/react/dist/ssr/Check';
import { PillButton } from './landing/Machined';
import { FIELD, FIELD_BAD, NUMBER, MONO_LABEL, StatusLine, Footnote } from './settings/parts';

/*
 * Baseline rates: one row per room tier, one column per day class, each cell a
 * min-to-max range. A matrix rather than a card per tier, because the thing
 * you compare is the same day across tiers, and a stack of cards hid that.
 *
 * A range is checked as you type (a minimum above its maximum, or an empty or
 * zero value, is marked on the field and blocks the save), and Save only wakes
 * up once something has actually changed.
 */

const DAY_CLASSES: { key: 'weekday' | 'sunday' | 'weekend'; label: string }[] = [
  { key: 'weekday', label: 'Weekday, Mon to Thu' },
  { key: 'sunday', label: 'Sunday' },
  { key: 'weekend', label: 'Weekend, Fri and Sat' },
];

type Cls = (typeof DAY_CLASSES)[number]['key'];

/** Why a range can't be saved, or null when it can. */
function rangeProblem(r: DayRange): string | null {
  if (!Number.isFinite(r.min) || !Number.isFinite(r.max) || r.min <= 0 || r.max <= 0) return 'Both ends need a price above $0.';
  if (r.min > r.max) return 'The minimum is above the maximum.';
  return null;
}

export default function BaselineEditor({ propertyId }: { propertyId: string }) {
  const [config, setConfig] = useState<RatesConfig | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad' | 'muted'; text: string } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const canWrite = useCanWrite();

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/rates-config?propertyId=${propertyId}`).catch(() => null);
      if (res?.ok) {
        const next = ((await res.json()) as { config: RatesConfig }).config;
        setConfig(next);
        setSaved(JSON.stringify(next));
      } else setLoadFailed(true);
    })();
  }, [propertyId]);

  const problems = useMemo(() => {
    const out = new Map<string, string>();
    config?.tiers.forEach((t) =>
      DAY_CLASSES.forEach(({ key }) => {
        const p = rangeProblem(t[key]);
        if (p) out.set(`${t.id}:${key}`, p);
      }),
    );
    if (config && (!Number.isFinite(config.upliftCapPct) || config.upliftCapPct < 0 || config.upliftCapPct > 200)) {
      out.set('cap', 'Use a cap between 0% and 200%.');
    }
    return out;
  }, [config]);

  const dirty = config != null && JSON.stringify(config) !== saved;

  function setRange(tierIdx: number, cls: Cls, field: keyof DayRange, value: string) {
    if (!config) return;
    const tiers = config.tiers.map((t, i) =>
      i === tierIdx ? { ...t, [cls]: { ...t[cls], [field]: value === '' ? Number.NaN : Number(value) } } : t,
    );
    setConfig({ ...config, tiers });
    setStatus(null);
  }

  async function save() {
    if (!config || problems.size > 0) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/rates-config?propertyId=${propertyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus({ tone: 'bad', text: json.error ?? 'The baselines were not saved. Try again.' });
        return;
      }
      setSaved(JSON.stringify(config));
      // Apply immediately: rescore the last collected data with the new baselines.
      setStatus({ tone: 'muted', text: 'Saved. Applying to the latest data.' });
      const re = await fetch(`/api/recompute?propertyId=${propertyId}`, { method: 'POST' }).catch(() => null);
      setStatus(
        re?.ok
          ? { tone: 'ok', text: 'Saved and applied. Recommendations were recomputed from the latest collected data.' }
          : { tone: 'ok', text: 'Saved. It applies on the next collection run, as there is no collected data to recompute yet.' },
      );
    } catch {
      setStatus({ tone: 'bad', text: 'Could not reach the server, so nothing was saved. Check your connection.' });
    } finally {
      setSaving(false);
    }
  }

  if (loadFailed) {
    return (
      <p className="rounded-[1.25rem] bg-[#0b1c30]/[0.05] px-5 py-4 text-[14.5px] text-[#44474d]">
        The baseline rates could not be loaded. Reload the page to try again.
      </p>
    );
  }

  if (!config) {
    return (
      <div aria-busy="true" aria-label="Loading baselines" className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 rounded-[1rem] bg-[#0b1c30]/[0.05] motion-safe:animate-pulse" />
        ))}
      </div>
    );
  }

  const disabled = !canWrite;

  return (
    <div className="space-y-6">
      {/* The matrix. Scrolls sideways on a phone rather than crushing six fields per row. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[640px] border-separate border-spacing-y-2">
          <thead>
            <tr>
              <th className={`${MONO_LABEL} w-[26%] pb-1 text-left font-normal`}>Room tier</th>
              {DAY_CLASSES.map((d) => (
                <th key={d.key} className={`${MONO_LABEL} pb-1 pl-3 text-left font-normal`}>
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.tiers.map((t, ti) => (
              <tr key={t.id} className="align-top">
                <th scope="row" className="rounded-l-[1rem] bg-[#0b1c30]/[0.035] py-3.5 pl-4 pr-3 text-left">
                  <span className="block text-[14.5px] font-medium leading-snug">{t.label.split(' (')[0]}</span>
                  {t.label.includes(' (') && (
                    <span className="mt-0.5 block text-[12.5px] font-normal text-[#44474d]">
                      {t.label.slice(t.label.indexOf('(') + 1, t.label.lastIndexOf(')'))}
                    </span>
                  )}
                </th>
                {DAY_CLASSES.map(({ key, label }, ci) => {
                  const problem = problems.get(`${t.id}:${key}`);
                  const id = `range-${t.id}-${key}`;
                  return (
                    <td
                      key={key}
                      className={`bg-[#0b1c30]/[0.035] px-3 py-3 ${ci === DAY_CLASSES.length - 1 ? 'rounded-r-[1rem]' : ''}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <MoneyField
                          value={t[key].min}
                          onChange={(v) => setRange(ti, key, 'min', v)}
                          label={`${t.label}, ${label}, minimum`}
                          bad={!!problem}
                          disabled={disabled}
                          describedBy={problem ? id : undefined}
                        />
                        <span aria-hidden className="text-[13px] text-[#44474d]">to</span>
                        <MoneyField
                          value={t[key].max}
                          onChange={(v) => setRange(ti, key, 'max', v)}
                          label={`${t.label}, ${label}, maximum`}
                          bad={!!problem}
                          disabled={disabled}
                          describedBy={problem ? id : undefined}
                        />
                      </div>
                      {problem && (
                        <p id={id} className="mt-1.5 text-[12.5px] leading-snug text-[#b45309]">
                          {problem}
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[1rem] bg-[#0b1c30]/[0.035] px-4 py-3.5">
        <label htmlFor="uplift-cap" className="text-[14.5px] font-medium">
          Event uplift cap
        </label>
        <div className="relative w-28">
          <input
            id="uplift-cap"
            type="number"
            inputMode="numeric"
            className={`${FIELD} ${NUMBER} pr-9 tabular-nums ${problems.has('cap') ? FIELD_BAD : ''}`}
            value={Number.isFinite(config.upliftCapPct) ? config.upliftCapPct : ''}
            onChange={(e) => {
              setConfig({ ...config, upliftCapPct: e.target.value === '' ? Number.NaN : Number(e.target.value) });
              setStatus(null);
            }}
            disabled={disabled}
            aria-describedby="uplift-cap-help"
          />
          <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-[#44474d]">
            %
          </span>
        </div>
        <p id="uplift-cap-help" className={`text-[13.5px] ${problems.has('cap') ? 'text-[#b45309]' : 'text-[#44474d]'}`}>
          {problems.get('cap') ?? 'The most any event night can raise a rate above its baseline.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {canWrite ? (
          <PillButton
            onClick={save}
            disabled={saving || !dirty || problems.size > 0}
            icon={<CheckIcon weight="light" className="h-4 w-4" />}
          >
            {saving ? 'Saving' : 'Save baselines'}
          </PillButton>
        ) : (
          <ReadOnlyNote what="Editing baseline rates" />
        )}
        {canWrite && !status && problems.size > 0 && (
          <p className="text-[13.5px] text-[#b45309]">Fix the marked fields to save.</p>
        )}
        <StatusLine status={status} />
      </div>

      <Footnote>
        A night&apos;s recommendation is its baseline times the event uplift, floored at your minimum and kept in check by
        the comp set median on quiet nights. Rate Radar never changes a price anywhere; these numbers only shape its
        suggestions.
      </Footnote>
    </div>
  );
}

function MoneyField({
  value,
  onChange,
  label,
  bad,
  disabled,
  describedBy,
}: {
  value: number;
  onChange: (v: string) => void;
  label: string;
  bad: boolean;
  disabled: boolean;
  describedBy?: string;
}) {
  return (
    <span className="relative block min-w-0 flex-1">
      <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-[#44474d]">
        $
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        className={`${FIELD} ${NUMBER} pl-7 pr-2 tabular-nums ${bad ? FIELD_BAD : ''}`}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        aria-invalid={bad || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
      />
    </span>
  );
}
