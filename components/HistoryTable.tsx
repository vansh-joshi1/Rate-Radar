'use client';
import { useState } from 'react';
import type { HistoryRecord } from '../lib/scoring/types';
import { fmtDowDay } from '../lib/date';
import { useCanWrite } from './RoleProvider';
import { Bezel } from './landing/Machined';
import { FIELD, FIELD_BAD, MONO_LABEL, NUMBER } from './settings/parts';

const TIERS = [
  { id: 'standard', label: 'Standard' },
  { id: 'superior', label: 'Superior' },
] as const;

type Actuals = Record<string, Record<string, number>>;

/*
 * Recommended vs. actually charged, on the Machined Instrument language
 * (DESIGN.md): mono sentence-case headers, navy-tinted dividers, pill fields.
 * A charged rate saves on blur and stays in place; a refused one keeps the
 * warn ring and says why, instead of vanishing on a page reload.
 */
export default function HistoryTable({ history, actuals }: { history: HistoryRecord[]; actuals: Actuals }) {
  const canWrite = useCanWrite();
  const [saved, setSaved] = useState<Actuals>(actuals);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save(date: string, tierId: string, value: string) {
    const key = date + tierId;
    const rate = Number(value);
    if (value === '' || rate === saved[date]?.[tierId]) return;
    const res = await fetch('/api/actual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, tierId, rate }),
    }).catch(() => null);
    setErrors((e) => ({ ...e, [key]: res?.ok ? '' : 'Enter a rate from $20 to $1,000.' }));
    if (res?.ok) setSaved((s) => ({ ...s, [date]: { ...s[date], [tierId]: rate } }));
  }

  const th = `whitespace-nowrap px-4 py-3 text-left font-normal ${MONO_LABEL}`;

  return (
    <Bezel core="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-[#0b1c30]/[0.06]">
              <th scope="col" className={`${th} pl-6`}>Night</th>
              <th scope="col" className={th}>Recommended</th>
              <th scope="col" className={th}>Demand score</th>
              <th scope="col" className={th}>Top driver</th>
              {TIERS.map((t) => (
                <th key={t.id} scope="col" className={`${th} last:pr-6`}>
                  Charged, {t.label.toLowerCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.date} className="border-b border-[#0b1c30]/[0.06] align-top last:border-0">
                <th scope="row" className="whitespace-nowrap py-3 pl-6 pr-4 text-left font-medium">
                  {fmtDowDay(h.date)}
                </th>
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                  ${h.recommendedStandard} <span className="font-normal text-[#44474d]">/ ${h.recommendedSuperior}</span>
                </td>
                <td className="px-4 py-3 tabular-nums">{h.nightScore}</td>
                <td className="min-w-[12rem] px-4 py-3 text-[#44474d]">{h.topDriver}</td>
                {TIERS.map((t) => {
                  const err = errors[h.date + t.id];
                  const value = saved[h.date]?.[t.id];
                  return (
                    <td key={t.id} className="px-4 py-2 last:pr-6">
                      {canWrite ? (
                        <>
                          <input
                            type="number"
                            inputMode="decimal"
                            aria-label={`Charged, ${t.label.toLowerCase()}, ${fmtDowDay(h.date)}`}
                            aria-invalid={!!err}
                            className={`${FIELD} ${NUMBER} h-9 w-28 tabular-nums ${err ? FIELD_BAD : ''}`}
                            defaultValue={value ?? ''}
                            placeholder="$"
                            onBlur={(e) => save(h.date, t.id, e.target.value)}
                          />
                          {err && <p className="mt-1 text-[12.5px] text-[#b45309]">{err}</p>}
                        </>
                      ) : (
                        <span className="tabular-nums">{value != null ? `$${value}` : <span className="text-[#44474d]">Not entered</span>}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-[14px] text-[#44474d]">
                  No history yet. Nights appear here after the first collection run.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Bezel>
  );
}
