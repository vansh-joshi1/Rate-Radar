'use client';

import { useState, type FormEvent } from 'react';
import type { ChatTurn } from '../lib/bellhop/gemini';
import type { BookingReading } from '../lib/bookings';

const STARTERS = [
  'Why is tonight priced where it is?',
  'What events are coming up this week?',
  'What if I charged $10 less than the recommendation tonight?',
];

export default function Bellhop({ totalRooms, tonight }: { totalRooms: number; tonight: BookingReading | null }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: ChatTurn[] = [...turns, { role: 'user', text: q }];
    setTurns([...history, { role: 'assistant', text: '' }]);
    setDraft('');
    setBusy(true);
    const show = (text: string) => setTurns([...history, { role: 'assistant', text }]);
    try {
      const res = await fetch('/api/bellhop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        show((await res.json().catch(() => null))?.error ?? 'Bellhop is unavailable right now.');
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        show(text);
      }
    } catch {
      show('Bellhop is unavailable right now.');
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(draft);
  }

  return (
    <div className="card flex flex-col gap-4">
      <BookingsCard totalRooms={totalRooms} initial={tonight} />

      <div className="flex flex-col gap-3" aria-live="polite">
        {turns.length === 0 && (
          <p className="text-sm text-muted">
            Ask about any night Rate Radar has priced. Bellhop answers from the same numbers and reasoning as the
            calendar, and it never changes a price.
          </p>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm ${
              t.role === 'user' ? 'self-end bg-accent text-white' : 'self-start bg-ink/[0.04]'
            }`}
          >
            {t.text || <span className="text-muted">Thinking…</span>}
          </div>
        ))}
      </div>

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button key={s} type="button" className="btn btn-sm" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="bellhop-q" className="sr-only">Ask Bellhop</label>
        <input
          id="bellhop-q"
          className="field"
          placeholder="Ask Bellhop about a night, an event, or a price…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={4000}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}

/** Bellhop's one question back: tonight's rooms on the books. Saved straight to /api/bookings, never through the model. */
function BookingsCard({ totalRooms, initial }: { totalRooms: number; initial: BookingReading | null }) {
  const [latest, setLatest] = useState(initial);
  const [editing, setEditing] = useState(!initial);
  const [rooms, setRooms] = useState('');
  const [error, setError] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rooms: Number(rooms) }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setError(json?.error ?? 'Could not save. Try again.');
    setLatest(json.reading);
    setEditing(false);
    setRooms('');
  }

  if (!editing && latest) {
    const at = new Date(latest.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return (
      <p className="text-sm text-muted">
        Tonight: <span className="font-semibold text-ink tabular-nums">{latest.rooms} of {totalRooms}</span> rooms
        booked as of {at}.{' '}
        <button type="button" className="font-semibold text-accent underline" onClick={() => setEditing(true)}>
          Update
        </button>
      </p>
    );
  }

  return (
    <form onSubmit={save} className="self-start rounded-xl bg-ink/[0.04] px-4 py-3 text-sm">
      <label htmlFor="bellhop-rooms" className="mb-2 block">
        How many of your {totalRooms} rooms are booked for tonight?
      </label>
      <div className="flex items-center gap-2">
        <input
          id="bellhop-rooms"
          type="number"
          inputMode="numeric"
          min={0}
          max={totalRooms}
          step={1}
          required
          className="field w-24"
          value={rooms}
          onChange={(e) => setRooms(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-sm">Save</button>
      </div>
      {error && <p className="mt-2 text-bad" role="alert">{error}</p>}
    </form>
  );
}
