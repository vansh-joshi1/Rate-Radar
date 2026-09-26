'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PillButton } from './landing/Machined';
import { FIELD, StatusLine } from './settings/parts';

/**
 * Approve one access request: creates the hotel's property, makes the
 * requester its owner and emails them. The airport is optional; with one set,
 * the hotel also gets flight-delay alerts. It asks once before approving,
 * because approving lets a stranger into a new dashboard.
 */
export default function ApproveRequest({ email, name }: { email: string; name: string }) {
  const router = useRouter();
  const [airport, setAirport] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  async function approve() {
    setBusy(true);
    setStatus(null);
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, airport }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { error?: string; emailed?: boolean } | null;
    setBusy(false);
    setConfirming(false);
    if (!res?.ok) {
      setStatus({ tone: 'bad', text: data?.error ?? 'Could not reach the server. Try again.' });
      return;
    }
    setStatus({
      tone: 'ok',
      text: data?.emailed
        ? `Approved. ${email} has been emailed.`
        : `Approved, but the email didn't send. Tell ${email} they can sign in now.`,
    });
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="block w-28">
          <span className="sr-only">Nearest airport code for {name}</span>
          <input
            className={`${FIELD} uppercase`}
            value={airport}
            onChange={(e) => setAirport(e.target.value.slice(0, 4))}
            placeholder="Airport"
            aria-describedby={`airport-help-${email}`}
          />
        </label>
        {confirming ? (
          <>
            <PillButton size="sm" onClick={approve} disabled={busy}>
              {busy ? 'Approving…' : `Approve ${name}`}
            </PillButton>
            <PillButton size="sm" variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </PillButton>
          </>
        ) : (
          <PillButton size="sm" onClick={() => setConfirming(true)}>
            Approve
          </PillButton>
        )}
      </div>
      <p id={`airport-help-${email}`} className="text-xs text-muted">
        Optional: FAA code (e.g. BNA) for flight-delay alerts.
      </p>
      <StatusLine status={status} />
    </div>
  );
}
