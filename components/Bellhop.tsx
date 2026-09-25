'use client';

import { useState, type FormEvent } from 'react';
import { Bezel, PillButton } from './landing/Machined';
import { DIVIDER, FIELD, FIELD_BAD, FOCUS, MONO_LABEL, NUMBER, StatusLine } from './settings/parts';
import type { ChatTurn } from '../lib/bellhop/gemini';
import type { BookingReading } from '../lib/bookings';

const STARTERS = [
  'Why is tonight priced where it is?',
  'What events are coming up this week?',
  'What if I charged $10 less tonight?',
];

/** An answer Bellhop could not give. Shown in warn, never sent back to the model as history. */
type Turn = ChatTurn & { failed?: boolean };

/*
 * Bellhop, on the Machined Instrument language (DESIGN.md). Two enclosures on
 * the 12-column grid: the conversation (8) and tonight's rooms-booked reading
 * (4). On a phone the reading comes first, because the front desk opens this
 * page to answer that one question.
 */
export default function Bellhop({ totalRooms, tonight }: { totalRooms: number; tonight: BookingReading | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
      <Bezel className="lg:order-2 lg:col-span-4 lg:self-start" core="p-6">
        <TonightReading totalRooms={totalRooms} initial={tonight} />
      </Bezel>
      <Bezel className="lg:order-1 lg:col-span-8" core="p-6 md:p-8">
        <Conversation />
      </Bezel>
    </div>
  );
}

function Conversation() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const sent: Turn[] = [...turns, { role: 'user', text: q }];
    const show = (text: string, failed = false) => setTurns([...sent, { role: 'assistant', text, failed }]);
    setTurns([...sent, { role: 'assistant', text: '' }]);
    setDraft('');
    setBusy(true);
    try {
      const res = await fetch('/api/bellhop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: sent.filter((t) => !t.failed).map(({ role, text }) => ({ role, text })),
        }),
      });
      if (!res.ok || !res.body) {
        show((await res.json().catch(() => null))?.error ?? 'Bellhop is unavailable right now.', true);
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
      show('Bellhop is unavailable right now.', true);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(draft);
  }

  return (
    <div className="flex flex-col gap-6">
      {turns.length === 0 ? (
        <div className="flex flex-col gap-4">
          <p className="max-w-[60ch] text-pretty text-[15px] leading-relaxed text-[#44474d]">
            Ask about any night Rate Radar has priced. Bellhop answers from the same numbers and reasoning as the
            calendar, and it never changes a price.
          </p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => ask(s)}
                className={`rounded-full bg-white px-4 py-2 text-left text-[13.5px] font-medium text-[#0b1c30] ring-1 ring-[#0b1c30]/[0.08] transition-colors duration-150 hover:bg-[#f3f5fc] active:scale-[0.98] motion-reduce:transition-none ${FOCUS}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ol className="flex flex-col gap-6" aria-live="polite">
          {turns.map((t, i) =>
            t.role === 'user' ? (
              <li
                key={i}
                className="max-w-[85%] self-end whitespace-pre-wrap rounded-[1.25rem] bg-[#0b1c30]/[0.05] px-4 py-2.5 text-[15px] leading-relaxed text-[#1a1b20]"
              >
                {t.text}
              </li>
            ) : (
              <li key={i} className="flex max-w-[65ch] flex-col gap-1.5">
                <span className={MONO_LABEL}>Bellhop</span>
                {t.text ? (
                  <p
                    className={`whitespace-pre-wrap text-pretty text-[15px] leading-relaxed ${
                      t.failed ? 'text-[#b45309]' : 'text-[#1a1b20]'
                    }`}
                  >
                    {t.text}
                  </p>
                ) : (
                  <Reading />
                )}
              </li>
            )
          )}
        </ol>
      )}

      <div className={DIVIDER} />

      <form onSubmit={submit} className="flex items-center gap-2">
        <label htmlFor="bellhop-q" className="sr-only">
          Ask Bellhop
        </label>
        <input
          id="bellhop-q"
          className={`${FIELD} h-11`}
          placeholder="Ask Bellhop"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={4000}
        />
        <PillButton type="submit" disabled={busy || !draft.trim()}>
          Ask
        </PillButton>
      </form>
    </div>
  );
}

/** Placeholder bars in the shape of an answer while the first words arrive. */
function Reading() {
  return (
    <div className="flex flex-col gap-2 py-1" role="status" aria-label="Bellhop is answering">
      {['w-11/12', 'w-4/5', 'w-2/3'].map((w) => (
        <span key={w} className={`h-3 ${w} animate-pulse rounded-full bg-[#0b1c30]/[0.06] motion-reduce:animate-none`} />
      ))}
    </div>
  );
}

/** Tonight's rooms on the books: a reading, saved straight to /api/bookings and never through the model. */
function TonightReading({ totalRooms, initial }: { totalRooms: number; initial: BookingReading | null }) {
  const [latest, setLatest] = useState(initial);
  const [editing, setEditing] = useState(!initial);
  const [rooms, setRooms] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rooms: Number(rooms) }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setSaving(false);
    if (!res?.ok) return setError(json?.error ?? 'Could not save. Try again.');
    setLatest(json.reading);
    setEditing(false);
    setRooms('');
  }

  return (
    <div className="flex flex-col gap-4">
      <span className={MONO_LABEL}>Rooms booked tonight</span>

      {latest && !editing ? (
        <>
          <div>
            <p className="text-[40px] font-semibold leading-none tracking-tight tabular-nums text-[#1a1b20]">
              {latest.rooms}
              <span className="text-[20px] font-medium text-[#44474d]"> of {totalRooms}</span>
            </p>
            <p className="mt-2 text-[13.5px] text-[#44474d]">
              {Math.round((latest.rooms / totalRooms) * 100)}% full as of{' '}
              {new Date(latest.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`self-start rounded-full text-[13.5px] font-medium text-[#44474d] underline decoration-[#0b1c30]/20 underline-offset-4 transition-colors duration-150 hover:text-[#1a1b20] ${FOCUS}`}
          >
            Update the count
          </button>
        </>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-3">
          <label htmlFor="bellhop-rooms" className="text-[15px] leading-relaxed text-[#1a1b20]">
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
              aria-invalid={!!error}
              aria-describedby={error ? 'bellhop-rooms-error' : undefined}
              className={`${FIELD} ${NUMBER} w-28 tabular-nums ${error ? FIELD_BAD : ''}`}
              value={rooms}
              onChange={(e) => setRooms(e.target.value)}
            />
            <PillButton type="submit" size="sm" disabled={saving || rooms === ''}>
              {saving ? 'Saving' : 'Save'}
            </PillButton>
          </div>
          <div id="bellhop-rooms-error">
            <StatusLine status={error ? { tone: 'bad', text: error } : null} />
          </div>
          <p className="text-[13px] leading-relaxed text-[#44474d]">
            Recorded with the time, so later readings show how tonight filled.
          </p>
        </form>
      )}
    </div>
  );
}
