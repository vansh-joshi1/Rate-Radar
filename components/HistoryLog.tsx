'use client';
import { useState } from 'react';
import type { HistoryRecord } from '../lib/scoring/types';

export default function HistoryLog({
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
    <section>
      <h2>History — recommended vs actually charged</h2>
      <p className="muted small" style={{ marginBottom: 10 }}>
        Enter what you actually charged so you can judge over time whether this thing is useful.
      </p>
      <table>
        <thead>
          <tr><th>Date</th><th>Recommended (std / queen)</th><th>Signal</th><th>Top driver</th><th>Actually charged (std)</th><th>(queen)</th></tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.date}>
              <td>{h.date}</td>
              <td>${h.recommendedStandard} / ${h.recommendedQueen}</td>
              <td>{h.nightScore}</td>
              <td className="small muted">{h.topDriver}</td>
              {(['standard', 'queen'] as const).map((tier) => (
                <td key={tier}>
                  <input
                    type="number"
                    style={{ width: 80 }}
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
            <tr><td colSpan={6} className="muted">No history yet — appears after the first collection run.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
