'use client';
import { useEffect, useState } from 'react';
import type { DayRange, RatesConfig, TierBaseline } from '../lib/rates-config';

const DAY_CLASSES: { key: 'weekday' | 'sunday' | 'weekend'; label: string }[] = [
  { key: 'weekday', label: 'Weekday (Mon–Thu)' },
  { key: 'sunday', label: 'Sunday' },
  { key: 'weekend', label: 'Weekend (Fri–Sat)' },
];

export default function BaselineEditor({ propertyId }: { propertyId: string }) {
  const [config, setConfig] = useState<RatesConfig | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad' | 'muted'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/rates-config?propertyId=${propertyId}`);
      if (res.ok) setConfig(((await res.json()) as { config: RatesConfig }).config);
      else setStatus({ tone: 'bad', text: 'Could not load baseline config.' });
    })();
  }, [propertyId]);

  function setRange(tierIdx: number, cls: 'weekday' | 'sunday' | 'weekend', field: keyof DayRange, value: string) {
    if (!config) return;
    const tiers = config.tiers.map((t, i) =>
      i === tierIdx ? { ...t, [cls]: { ...t[cls], [field]: Number(value) } } : t
    );
    setConfig({ ...config, tiers });
    setStatus(null);
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    setStatus(null);
    const res = await fetch(`/api/rates-config?propertyId=${propertyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatus({ tone: 'bad', text: json.error ?? 'Save failed.' });
      setSaving(false);
      return;
    }
    // Apply immediately: rescore the last collected data with the new baselines.
    setStatus({ tone: 'muted', text: 'Saved — applying to the latest data…' });
    const re = await fetch(`/api/recompute?propertyId=${propertyId}`, { method: 'POST' });
    setStatus(
      re.ok
        ? { tone: 'ok', text: 'Saved and applied — recommendations recomputed from the latest collected data.' }
        : { tone: 'ok', text: 'Saved. Applies on the next collection run (no collected data to recompute yet).' }
    );
    setSaving(false);
  }

  if (!config) return <p className="text-sm text-muted">{status?.text ?? 'Loading baselines…'}</p>;

  return (
    <div>
      {config.tiers.map((t: TierBaseline, ti) => (
        <div key={t.id} className="card mb-4">
          <div className="mb-3 font-semibold">{t.label}</div>
          <div className="grid gap-4 sm:grid-cols-3">
            {DAY_CLASSES.map(({ key, label }) => (
              <div key={key}>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">$</span>
                  <input
                    type="number"
                    className="field px-2.5 py-1.5"
                    value={t[key].min}
                    onChange={(e) => setRange(ti, key, 'min', e.target.value)}
                    aria-label={`${t.label} ${label} minimum`}
                  />
                  <span className="text-muted">–</span>
                  <input
                    type="number"
                    className="field px-2.5 py-1.5"
                    value={t[key].max}
                    onChange={(e) => setRange(ti, key, 'max', e.target.value)}
                    aria-label={`${t.label} ${label} maximum`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card mb-4 flex flex-wrap items-center gap-4">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">Event uplift cap</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="field w-24 px-2.5 py-1.5"
              value={config.upliftCapPct}
              onChange={(e) => {
                setConfig({ ...config, upliftCapPct: Number(e.target.value) });
                setStatus(null);
              }}
              aria-label="Event uplift cap percent"
            />
            <span className="text-sm text-muted">% — the most any event night can raise a rate above baseline</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save baselines'}
        </button>
        {status && (
          <span className={`text-sm ${status.tone === 'ok' ? 'text-ok' : status.tone === 'bad' ? 'text-bad' : 'text-muted'}`}>
            {status.text}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        The recommendation for a night is baseline × event uplift, floored at your minimum and sanity-bounded by the
        compset median on quiet nights. Rate Radar never changes a price anywhere — these numbers only shape its suggestions.
      </p>
    </div>
  );
}
