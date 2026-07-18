'use client';
import { useState } from 'react';
import type { HistoryRecord } from '../lib/scoring/types';

export default function HistoryTable({
  history, actuals,
}: {
  history: HistoryRecord[]; actuals: Record<string, Record<string, number>>;
}) {
  const [saving, setSaving] = useState('');

  async function save(date: string, tierId: string, value: string) {
    const rate = Number(value);
    if (!rate) return;
    setSaving(date + tierId);
    await fetch('/api/actual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, tierId, rate }),
    });
    setSaving('');
    window.location.reload();
  }

  return (
    <div className="card p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="th">Date</th>
              <th className="th">Recommended (std / superior)</th>
              <th className="th">Signal</th>
              <th className="th">Top driver</th>
              <th className="th">Charged (std)</th>
              <th className="th">(superior)</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.date} className="hover:bg-ink/[0.03]">
                <td className="td">{h.date}</td>
                <td className="td font-serif">${h.recommendedStandard} / ${h.recommendedSuperior}</td>
                <td className="td">{h.nightScore}</td>
                <td className="td text-muted">{h.topDriver}</td>
                {(['standard', 'superior'] as const).map((tier) => (
                  <td key={tier} className="td">
                    <input
                      type="number"
                      className="field w-24 py-1.5"
                      defaultValue={actuals[h.date]?.[tier] ?? ''}
                      placeholder="$"
                      disabled={saving === h.date + tier}
                      onBlur={(e) => e.target.value && save(h.date, tier, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={6} className="td text-muted">No history yet — appears after the first collection run.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
