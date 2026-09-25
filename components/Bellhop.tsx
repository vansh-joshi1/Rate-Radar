'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CallBellIcon } from '@phosphor-icons/react/dist/ssr/CallBell';
import { LaptopIcon } from '@phosphor-icons/react/dist/ssr/Laptop';
import { Bezel, PillButton } from './landing/Machined';
import { DIVIDER, FIELD, FIELD_BAD, FOCUS, MONO_LABEL, NUMBER, StatusLine } from './settings/parts';
import type { ChatTurn } from '../lib/bellhop/gemini';
import type { BookingReading } from '../lib/bookings';

const STARTERS = [
  'Why is tonight priced where it is?',
  'What events are coming up this week?',
  'What if I charged $10 less tonight?',
];

const TEXT = 'text-pretty text-[15px] leading-relaxed text-[#1a1b20]';
const LINK = `rounded-full font-medium text-[#44474d] underline decoration-[#0b1c30]/20 underline-offset-4 transition-colors duration-150 hover:text-[#1a1b20] ${FOCUS}`;

/** An answer Bellhop could not give. Shown in warn, never sent back to the model as history. */
type Turn = ChatTurn & { failed?: boolean };

/*
 * Bellhop, on the Machined Instrument language (DESIGN.md): one enclosure that
 * fills the page, a header row, the conversation, and the composer pinned to
 * the bottom. Tonight's rooms-booked count is Bellhop's own first question in
 * the thread; it saves straight to /api/bookings and never passes through the
 * model, which reads it back from the store on the next question.
 */
export default function Bellhop({
  propertyName,
  totalRooms,
  tonight,
}: {
  propertyName: string;
  totalRooms: number;
  tonight: BookingReading | null;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLLIElement>(null);

  // Keep the newest words in view above the pinned composer as an answer streams in (the marker's
  // scroll margin clears the composer). ponytail: also pulls a reader who scrolled up back down mid-answer.
  useEffect(() => {
    if (turns.length) end.current?.scrollIntoView({ block: 'end', behavior: 'instant' });
  }, [turns]);

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
        // A stalled model stream would otherwise leave the chat busy forever; the abort also ends the body read.
        signal: AbortSignal.timeout(60_000),
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
    <Bezel core="flex min-h-[calc(100dvh-9rem)] flex-col">
      <header className="flex items-center gap-4 px-6 pb-5 pt-6 md:px-8">
        <BellhopAvatar size="lg" typing={busy} />
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight">Bellhop</h1>
          <p className="text-pretty text-[14px] leading-relaxed text-[#44474d]">
            Questions about {propertyName}&apos;s rates, answered from Rate Radar&apos;s own numbers.
          </p>
        </div>
      </header>
      <div className={DIVIDER} />

      <ol className="flex flex-1 flex-col gap-6 px-6 py-6 md:px-8" aria-live="polite">
        <li>
          <BellhopSays>
            <p className={TEXT}>
              Ask me about any night Rate Radar has priced. I answer from the same numbers and reasoning as the
              calendar, and I never change a price.
            </p>
          </BellhopSays>
        </li>
        <RoomsBooked totalRooms={totalRooms} initial={tonight} />

        {turns.length === 0 && (
          // Full width on a phone so each pill stays on one line; aligned under the messages from sm up.
          <li className="flex flex-wrap gap-2 sm:pl-12">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className={`rounded-full bg-white px-4 py-2 text-left text-[13.5px] font-medium text-[#0b1c30] ring-1 ring-[#0b1c30]/[0.08] transition-colors duration-150 hover:bg-[#f3f5fc] active:scale-[0.98] motion-reduce:transition-none ${FOCUS}`}
              >
                {s}
              </button>
            ))}
          </li>
        )}

        {turns.map((t, i) =>
          t.role === 'user' ? (
            <UserSays key={i}>{t.text}</UserSays>
          ) : (
            <li key={i} className="animate-fade-in-up">
              <BellhopSays typing={busy && i === turns.length - 1}>
                {t.text ? (
                  <p className={`whitespace-pre-wrap ${TEXT} ${t.failed ? '!text-[#b45309]' : ''}`}>{t.text}</p>
                ) : (
                  <p className="text-[15px] text-[#44474d]" role="status">
                    Looking at the numbers
                  </p>
                )}
              </BellhopSays>
            </li>
          )
        )}
        <li ref={end} aria-hidden className="scroll-mb-32" />
      </ol>

      {/* Pinned while the page scrolls, so a long answer never pushes the composer out of reach. */}
      <div className="sticky bottom-0 rounded-b-[calc(2rem-0.375rem)] bg-white px-6 pb-6 md:px-8">
        <div className={`${DIVIDER} mb-4`} />
        <div className="flex items-center gap-2">
          <form onSubmit={submit} className="flex flex-1 items-center gap-2">
            <label htmlFor="bellhop-q" className="sr-only">
              Ask Bellhop
            </label>
            <input
              id="bellhop-q"
              className={`${FIELD} h-12`}
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
        {turns.length > 0 && !busy && (
          <button type="button" onClick={() => setTurns([])} className={`mt-3 text-[13px] ${LINK}`}>
            Start over
          </button>
        )}
      </div>
    </Bezel>
  );
}

/**
 * Bellhop's first question in every thread: tonight's rooms on the books. With
 * no reading yet it asks, with the number box inside its own message; once
 * answered, the answer sits in the thread as the user's reply.
 */
function RoomsBooked({ totalRooms, initial }: { totalRooms: number; initial: BookingReading | null }) {
  const [latest, setLatest] = useState(initial);
  const [justSaved, setJustSaved] = useState(false);
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
    setJustSaved(true);
    setEditing(false);
    setRooms('');
  }

  const at = latest && new Date(latest.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const pct = latest && Math.round((latest.rooms / totalRooms) * 100);
  const update = (
    <button type="button" onClick={() => setEditing(true)} className={LINK}>
      Update
    </button>
  );

  if (editing) {
    return (
      <li className="animate-fade-in-up">
        <BellhopSays>
          <form onSubmit={save} className="flex flex-col gap-3">
            <label htmlFor="bellhop-rooms" className={TEXT}>
              How many of your {totalRooms} rooms are booked for tonight?
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="bellhop-rooms"
                type="number"
                inputMode="numeric"
                min={0}
                max={totalRooms}
                step={1}
                required
                autoFocus={!!latest}
                aria-invalid={!!error}
                aria-describedby={error ? 'bellhop-rooms-error' : 'bellhop-rooms-help'}
                className={`${FIELD} ${NUMBER} h-9 !w-28 tabular-nums ${error ? FIELD_BAD : ''}`}
                value={rooms}
                onChange={(e) => setRooms(e.target.value)}
              />
              <PillButton type="submit" size="sm" disabled={saving || rooms === ''}>
                {saving ? 'Saving' : 'Save'}
              </PillButton>
              {latest && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setError('');
                  }}
                  className={`px-2 text-[13.5px] ${LINK} no-underline`}
                >
                  Cancel
                </button>
              )}
            </div>
            <div id="bellhop-rooms-error">
              <StatusLine status={error ? { tone: 'bad', text: error } : null} />
            </div>
            <p id="bellhop-rooms-help" className="text-[13px] leading-relaxed text-[#44474d]">
              Saved with the time, so later answers show how tonight filled.
            </p>
          </form>
        </BellhopSays>
      </li>
    );
  }

  if (!latest) return null;

  // Answered in this visit: show the exchange. Answered earlier: one line from Bellhop.
  return justSaved ? (
    <>
      <UserSays>
        {latest.rooms} of {totalRooms} booked
      </UserSays>
      <li className="animate-fade-in-up">
        <BellhopSays>
          <p className={TEXT}>
            Saved at {at}. That&apos;s {pct}% full. {update}
          </p>
        </BellhopSays>
      </li>
    </>
  ) : (
    <li>
      <BellhopSays>
        <p className={TEXT}>
          Tonight you have <span className="font-semibold tabular-nums">{latest.rooms} of {totalRooms}</span> rooms
          booked ({pct}%), as of {at}. {update}
        </p>
      </BellhopSays>
    </li>
  );
}

function UserSays({ children }: { children: ReactNode }) {
  return (
    <li className="animate-fade-in-up max-w-[85%] self-end whitespace-pre-wrap rounded-[1.25rem] bg-[#0b1c30]/[0.05] px-4 py-2.5 text-[15px] leading-relaxed text-[#1a1b20]">
      {children}
    </li>
  );
}

/**
 * Bellhop's mark: the front-desk call bell in a tiny double bezel (a navy-tinted
 * tray around a white core). Navy on white rather than cobalt, so it never reads
 * as the user's own avatar or property badge, which are cobalt wash.
 *
 * While Bellhop answers, a small laptop slides up in front of it: keys light up
 * across the screen and the bell dips with each keystroke. Built from Phosphor
 * glyphs rather than a drawn character; DESIGN.md rules out mascots, and this
 * is the least illustration that still reads as "typing". Still under reduced
 * motion (globals.css).
 */
export function BellhopAvatar({ size = 'sm', typing = false }: { size?: 'sm' | 'lg'; typing?: boolean }) {
  const lg = size === 'lg';
  return (
    <span aria-hidden className="relative inline-flex shrink-0 self-start">
      <span className={`inline-flex rounded-full bg-[#0b1c30]/[0.05] ring-1 ring-[#0b1c30]/[0.06] ${lg ? 'p-1' : 'p-0.5'}`}>
        <span
          className={`flex items-center justify-center rounded-full bg-white text-[#0b1c30] shadow-[inset_0_1px_1px_rgba(255,255,255,1),0_1px_2px_rgba(11,28,48,0.08)] ${
            lg ? 'h-11 w-11' : 'h-8 w-8'
          }`}
        >
          <CallBellIcon weight="light" className={`${lg ? 'h-6 w-6' : 'h-[18px] w-[18px]'} ${typing ? 'bellhop-tap' : ''}`} />
        </span>
      </span>
      {typing && (
        // Centred in front of the bell's lower half, so it reads as the bell sitting at the laptop.
        <span className={`absolute inset-x-0 flex justify-center ${lg ? '-bottom-2.5' : '-bottom-2'}`}>
          <span
            className={`bellhop-laptop flex items-center justify-center rounded-full bg-white px-1 shadow-[0_2px_6px_-2px_rgba(11,28,48,0.3)] ring-1 ring-[#0b1c30]/[0.08] ${
              lg ? 'h-7' : 'h-6'
            }`}
          >
            <span className="relative flex">
              <LaptopIcon weight="fill" className={`${lg ? 'h-6 w-6' : 'h-5 w-5'} text-[#0b1c30]`} />
              {/* Three keys lighting in turn on the laptop's screen. */}
              <span className={`absolute inset-x-0 flex justify-center gap-[2px] ${lg ? 'top-[8px]' : 'top-[6px]'}`}>
                {[0, 1, 2].map((k) => (
                  <span
                    key={k}
                    className="bellhop-key h-[2px] w-[2px] rounded-full bg-white"
                    style={{ animationDelay: `${k * 150}ms` }}
                  />
                ))}
              </span>
            </span>
          </span>
        </span>
      )}
    </span>
  );
}

/** One thing Bellhop says: the avatar, its name, and the content beside them. */
function BellhopSays({ children, typing = false }: { children: ReactNode; typing?: boolean }) {
  return (
    <div className="flex max-w-[70ch] gap-3">
      <BellhopAvatar typing={typing} />
      <div className="min-w-0 flex-1 pt-1">
        <span className={`mb-1 block ${MONO_LABEL}`}>Bellhop</span>
        {children}
      </div>
    </div>
  );
}
