'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr/ArrowLeft';
import { CheckIcon } from '@phosphor-icons/react/dist/ssr/Check';
import { PlusIcon } from '@phosphor-icons/react/dist/ssr/Plus';
import { RadarIcon } from '../../components/RadarMark';
import { Bezel, PillButton, SPRING } from '../../components/landing/Machined';
import { DOT_FIELD, Grain, HeroRadar } from '../../components/landing/Backdrop';
import { FIELD, LABEL, ring } from '../../components/AuthPanes';
import { assignTiers, nearbyHotels, type Candidate, type Nearby, type RoomTier, type RoomType } from '../../lib/onboarding';

/*
 * Onboarding, on the sign-in screen's machined parts (DESIGN.md → Marketing
 * surface): form open on the canvas at left, a Bezel at right reading back
 * what has been entered.
 *
 * Discovery does the typing for the owner. One search (app/api/onboarding/
 * discover) turns the address into "Is this you?" candidates and the nearby
 * hotels; confirming a candidate costs one more search for its channels and
 * room types. The comp set comes from the first search, free. Discovery is
 * metered and capped, so every step falls back to manual entry, said plainly
 * in State Warn (The Warn-Not-Fail Rule), never as an error.
 *
 * Still persists nothing, and says so on screen.
 */

const STEPS = ['Property', 'Listings', 'Rooms', 'Competitors'] as const;
const TYPES = ['Hotel', 'Motel', 'Inn'] as const;
const TIERS: { id: RoomTier; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'superior', label: 'Superior' },
];

type Status = 'idle' | 'loading' | 'done' | 'failed';
type Channel = { source: string; official: boolean; on: boolean };
type Room = RoomType & { tier: RoomTier };
type Prefetched = { token: string; channels: Omit<Channel, 'on'>[]; rooms: RoomType[] } | null;

type Answers = {
  email: string;
  name: string;
  address: string;
  rooms: string;
  type: (typeof TYPES)[number];
  direct: string;
  expedia: string;
  booking: string;
  competitors: string[];
};

const HEADINGS = [
  { title: 'Your property', lead: 'Your address is how we find your listings, your competitors and the events near you.' },
  { title: 'Is this you?', lead: 'We looked you up. Confirm the match and we will pull in your listings.' },
  { title: 'Your room types', lead: 'We sorted your rooms into two pricing tiers. Tap any we got wrong.' },
  { title: 'Pick your compset', lead: 'The hotels nearest you, priced against you on quiet nights. Add or remove any.' },
];

async function discover<T>(body: object): Promise<T> {
  const res = await fetch('/api/onboarding/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'upstream');
  return json as T;
}

const pill = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition-[transform,background-color,color] duration-500 ${SPRING} active:scale-[0.98] motion-reduce:transition-none ${ring} ${
    on ? 'bg-[#e5eeff] text-[#085ac0]' : 'bg-white text-[#44474d] ring-1 ring-[#0b1c30]/[0.08] hover:text-[#0b1c30]'
  }`;

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Setup progress">
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li
            key={label}
            aria-current={current ? 'step' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-[13px] font-medium transition-colors duration-500 ${SPRING} ${
              current
                ? 'bg-white text-[#0b1c30] shadow-[0_1px_2px_rgba(11,28,48,0.08)] ring-1 ring-[#0b1c30]/[0.08]'
                : 'bg-[#0b1c30]/[0.04] text-[#44474d]'
            }`}
          >
            <span
              aria-hidden
              className={`flex h-5 w-5 items-center justify-center rounded-full font-geist-mono text-[11px] tabular-nums ${
                done || current ? 'bg-[#085ac0] text-white' : 'bg-[#0b1c30]/[0.08] text-[#44474d]'
              }`}
            >
              {done ? <CheckIcon weight="bold" className="h-3 w-3" /> : i + 1}
            </span>
            {label}
            {done && <span className="sr-only">, done</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  ...rest
}: { id: string; label: string; value: string; onChange: (v: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'id' | 'value' | 'onChange'
>) {
  return (
    <div>
      <label className={LABEL} htmlFor={id}>
        {label}
      </label>
      <input id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} className={FIELD} {...rest} />
    </div>
  );
}

type PhotonFeature = {
  properties: {
    housenumber?: string;
    street?: string;
    name?: string;
    city?: string;
    state?: string;
    postcode?: string;
    countrycode?: string;
  };
};

/** "4202 Franklin Commons Ct, Franklin, TN 37067" from a Photon hit. */
function formatAddress({ properties: p }: PhotonFeature): string {
  const line = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street ?? p.name;
  return [line, p.city, [p.state, p.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/**
 * Street address with suggestions as you type, from Photon (OSM), the same
 * free geocoder the watchlist search uses (app/api/hotel-search). Called from
 * the browser (Photon allows any origin) and debounced to respect its fair
 * use. US only: prices are fetched with gl=us. The combobox follows the
 * watchlist search in components/CompetitorInsights.tsx.
 */
function AddressField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hits, setHits] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abort.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function type(v: string) {
    onChange(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 3) {
      setHits([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(v.trim())}&limit=10&lang=en&layer=house&layer=street`,
          { signal: ctrl.signal },
        );
        if (!res.ok) return;
        const { features } = (await res.json()) as { features: PhotonFeature[] };
        const list = [...new Set(features.filter((f) => f.properties.countrycode === 'US').map(formatAddress))].slice(0, 5);
        setHits(list);
        setActive(-1);
        setOpen(list.length > 0);
      } catch {
        /* aborted or offline: typing by hand still works */
      }
    }, 350);
  }

  function pick(address: string) {
    onChange(address);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative">
      <label className={LABEL} htmlFor="address">
        Street address
      </label>
      <input
        id="address"
        name="address"
        value={value}
        onChange={(e) => type(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || hits.length === 0) return;
          if (e.key === 'Escape') {
            setOpen(false);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => (i + 1) % hits.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i <= 0 ? hits.length - 1 : i - 1));
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault();
            pick(hits[active]);
          }
        }}
        required
        minLength={5}
        autoComplete="off"
        placeholder="Start typing your address"
        role="combobox"
        aria-expanded={open}
        aria-controls="address-suggestions"
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `address-option-${active}` : undefined}
        className={FIELD}
      />
      {open && (
        <ul
          id="address-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-[1.25rem] bg-white p-1.5 shadow-[0_24px_48px_-24px_rgba(11,28,48,0.35)] ring-1 ring-[#0b1c30]/[0.08]"
        >
          {hits.map((h, i) => (
            <li key={h} id={`address-option-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault() /* keep focus until click fires */}
                onClick={() => pick(h)}
                onMouseEnter={() => setActive(i)}
                className={`w-full truncate rounded-[0.875rem] px-4 py-2.5 text-left text-[14.5px] text-[#1a1b20] transition-colors duration-150 hover:bg-[#f3f5fc] ${
                  i === active ? 'bg-[#f3f5fc]' : ''
                }`}
              >
                {h}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Rows the size of what is coming, while discovery runs. */
function Skeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-[1.25rem] bg-[#0b1c30]/[0.05] motion-reduce:animate-none" />
      ))}
      <p className="pl-5 text-[13.5px] text-[#44474d]">{label}</p>
    </div>
  );
}

/** An honest limitation, in State Warn. */
function Note({ children }: { children: React.ReactNode }) {
  return <p className="pl-5 text-[13.5px] font-medium leading-relaxed text-[#b45309]">{children}</p>;
}

function whyFailed(e: unknown): string {
  return e instanceof Error && e.message === 'cap'
    ? 'Automatic lookup has reached its limit for today.'
    : 'We could not look this up right now.';
}

function Readback({ a, channels, rooms }: { a: Answers; channels: Channel[]; rooms: Room[] }) {
  const on = channels.filter((c) => c.on).length;
  const manual = [a.direct, a.expedia, a.booking].filter(Boolean).length;
  const rows: { label: string; value: string }[] = [
    { label: 'Hotel email', value: a.email },
    { label: 'Property', value: a.name },
    { label: 'Type', value: a.name ? a.type : '' },
    { label: 'Rooms', value: a.rooms },
    { label: 'Listings', value: on ? `${on} channels` : manual ? `${manual} added by hand` : '' },
    { label: 'Room types', value: rooms.length ? `${rooms.length} mapped` : '' },
    { label: 'Compset', value: a.competitors.length ? `${a.competitors.length} hotels` : '' },
  ];
  return (
    <div className="auth-rise w-full max-w-[440px]">
      <Bezel core="p-7 xl:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[22px] font-semibold tracking-tight text-[#0b1c30]">Setup</span>
          <span className="rounded-full bg-[#0b1c30]/[0.05] px-2.5 py-0.5 text-[12px] font-medium text-[#44474d]">
            Not saved
          </span>
        </div>
        <dl className="mt-5 divide-y divide-[#0b1c30]/[0.06]">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="font-geist-mono text-[12px] text-[#44474d]">{r.label}</dt>
              <dd
                className={`min-w-0 truncate text-right text-[14px] tabular-nums ${
                  r.value ? 'font-medium text-[#1a1b20]' : 'text-[#44474d]/70'
                }`}
              >
                {r.value || 'Not yet'}
              </dd>
            </div>
          ))}
        </dl>
      </Bezel>
      <p className="mt-8 max-w-[40ch] text-pretty pl-2 text-[15px] leading-relaxed text-[#44474d]">
        Our team connects your property with you. Nothing on this page is stored yet.
      </p>
    </div>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({
    email: '',
    name: '',
    address: '',
    rooms: '',
    type: 'Hotel',
    direct: '',
    expedia: '',
    booking: '',
    competitors: [],
  });

  // Search: the address lookup, run once per name + address.
  const [searched, setSearched] = useState('');
  const [search, setSearch] = useState<Status>('idle');
  const [searchWhy, setSearchWhy] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [hotels, setHotels] = useState<Candidate[]>([]);
  const [prefetched, setPrefetched] = useState<Prefetched>(null);
  // Details: the confirmed property's channels and rooms. `null` = none of these.
  const [chosen, setChosen] = useState<Candidate | null | undefined>(undefined);
  const [details, setDetails] = useState<Status>('idle');
  const [detailsWhy, setDetailsWhy] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [nearby, setNearby] = useState<Nearby[]>([]);
  const [extra, setExtra] = useState('');

  // Left by /signup's Start onboarding (components/AuthPanes.tsx). Read after
  // mount so server and client render the same first frame.
  useEffect(() => {
    try {
      const email = sessionStorage.getItem('onboarding-email');
      if (email) setA((prev) => ({ ...prev, email }));
    } catch {}
  }, []);

  const set = (k: keyof Answers) => (v: string) => setA((prev) => ({ ...prev, [k]: v }));
  const toggle = (hotel: string) =>
    setA((prev) => ({
      ...prev,
      competitors: prev.competitors.includes(hotel)
        ? prev.competitors.filter((h) => h !== hotel)
        : [...prev.competitors, hotel],
    }));

  async function runSearch() {
    const key = `${a.name}|${a.address}`;
    if (key === searched) return;
    setSearched(key);
    setSearch('loading');
    setChosen(undefined);
    setChannels([]);
    setRooms([]);
    try {
      const r = await discover<{ candidates: Candidate[]; hotels: Candidate[]; prefetched: Prefetched }>({
        kind: 'search',
        name: a.name,
        address: a.address,
      });
      setCandidates(r.candidates);
      setHotels(r.hotels);
      setPrefetched(r.prefetched);
      setSearch('done');
    } catch (e) {
      setSearchWhy(whyFailed(e));
      setSearch('failed');
    }
  }

  async function confirm(c: Candidate | null) {
    setChosen(c);
    if (!c) return;
    const near = nearbyHotels(c, hotels);
    setNearby(near);
    setA((prev) => ({ ...prev, competitors: near.slice(0, 6).map((n) => n.name) }));
    setDetails('loading');
    try {
      // The search may already hold this hotel's page; only look it up if not.
      const r =
        prefetched?.token === c.token && prefetched.channels.length > 0
          ? prefetched
          : await discover<{ channels: Omit<Channel, 'on'>[]; rooms: RoomType[] }>({
              kind: 'details',
              token: c.token,
              name: a.name,
              address: a.address,
            });
      setChannels(r.channels.map((ch) => ({ ...ch, on: true })));
      setRooms(assignTiers(r.rooms));
      setDetails('done');
    } catch (e) {
      setDetailsWhy(whyFailed(e));
      setDetails('failed');
    }
  }

  function addExtra() {
    const name = extra.trim();
    if (!name) return;
    setNearby((prev) => (prev.some((n) => n.name === name) ? prev : [...prev, { name, distanceMi: NaN }]));
    setA((prev) => (prev.competitors.includes(name) ? prev : { ...prev, competitors: [...prev.competitors, name] }));
    setExtra('');
  }

  // Manual listing entry: discovery failed, found nothing, or "none of these".
  const manual =
    search === 'failed' || (search === 'done' && candidates.length === 0) || chosen === null || details === 'failed';
  const busy = search === 'loading' || details === 'loading';
  const listingsReady = manual ? a.direct !== '' : details === 'done' && channels.some((c) => c.on);

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (step === 0) void runSearch();
    if (step < STEPS.length - 1) setStep(step + 1);
    else router.push('/overview');
  }

  const last = step === STEPS.length - 1;
  const blocked = (step === 1 && (busy || !listingsReady)) || (last && a.competitors.length === 0);

  return (
    <main
      className={`${GeistSans.variable} ${GeistMono.variable} relative isolate grid min-h-[100dvh] grid-cols-1 bg-[#f8f9ff] font-geist text-[#1a1b20] antialiased lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]`}
      style={DOT_FIELD}
    >
      <Grain />

      <section className="flex min-w-0 flex-col px-4 pb-8 pt-6 md:px-6 lg:px-12 xl:px-20">
        <div>
          <Link
            href="/"
            className={`inline-flex items-center gap-2 rounded-full bg-white/70 py-2 pl-4 pr-5 ring-1 ring-[#0b1c30]/[0.06] ${ring}`}
          >
            <RadarIcon className="h-5 w-5 text-[#085ac0]" />
            <span className="text-[15px] font-semibold tracking-tight text-[#0b1c30]">Rate Radar</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center py-10 md:py-12">
          <form onSubmit={next} className="mx-auto w-full max-w-[420px] lg:mx-0">
            <Stepper step={step} />

            <div key={step} className="auth-settle mt-8">
              <h1 className="text-balance text-[34px] font-semibold leading-[1.05] tracking-tighter text-[#0b1c30] md:text-[40px]">
                {step === 1 && manual ? 'Connect your listings' : step === 1 && chosen ? 'Your listings' : HEADINGS[step].title}
              </h1>
              <p className="mt-3 max-w-[44ch] text-pretty text-[15.5px] leading-relaxed text-[#44474d]">
                {step === 1 && manual
                  ? 'Public pages we check for rate parity.'
                  : step === 1 && chosen
                    ? 'We found you on these channels. Untick any that are not yours.'
                    : HEADINGS[step].lead}
              </p>

              <div className="mt-7 grid gap-5" aria-live="polite">
                {step === 0 && (
                  <>
                    <Field id="name" label="Property name" value={a.name} onChange={set('name')} required minLength={2} autoComplete="organization" placeholder="Red Roof Inn Franklin" />
                    <AddressField value={a.address} onChange={set('address')} />
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Field id="rooms" label="Number of rooms" value={a.rooms} onChange={set('rooms')} required type="number" inputMode="numeric" min={1} step={1} placeholder="55" className={`${FIELD} tabular-nums`} />
                      <fieldset>
                        <legend className={LABEL}>Type</legend>
                        <div className="flex h-12 items-center gap-1 rounded-full bg-[#0b1c30]/[0.05] p-1">
                          {TYPES.map((t) => (
                            <button
                              key={t}
                              type="button"
                              aria-pressed={a.type === t}
                              onClick={() => setA((prev) => ({ ...prev, type: t }))}
                              className={`h-full rounded-full px-4 text-[14px] font-medium transition-colors duration-300 ${ring} ${
                                a.type === t
                                  ? 'bg-white text-[#0b1c30] shadow-[0_1px_2px_rgba(11,28,48,0.08)]'
                                  : 'text-[#44474d] hover:text-[#0b1c30]'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  </>
                )}

                {step === 1 && search === 'loading' && <Skeleton label="Looking you up" />}

                {step === 1 && search === 'done' && candidates.length > 0 && chosen === undefined && (
                  <fieldset className="grid gap-2">
                    <legend className="sr-only">Matching properties</legend>
                    {candidates.map((c) => (
                      <button
                        key={c.token}
                        type="button"
                        onClick={() => void confirm(c)}
                        className={`group flex items-center justify-between gap-4 rounded-[1.25rem] bg-white px-5 py-4 text-left ring-1 ring-[#0b1c30]/[0.08] transition-[transform,box-shadow] duration-500 ${SPRING} hover:ring-[#085ac0]/40 active:scale-[0.99] motion-reduce:transition-none ${ring}`}
                      >
                        <span className="text-[15px] font-medium text-[#0b1c30]">{c.name}</span>
                        <span className="shrink-0 text-[13px] font-medium text-[#085ac0]">That&rsquo;s us</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => void confirm(null)}
                      className={`justify-self-start rounded-full px-5 py-2 text-[14px] font-medium text-[#44474d] hover:text-[#0b1c30] ${ring}`}
                    >
                      None of these
                    </button>
                  </fieldset>
                )}

                {step === 1 && details === 'loading' && <Skeleton label="Finding your listings" />}

                {step === 1 && details === 'done' && !manual && (
                  <fieldset>
                    <legend className="sr-only">Channels</legend>
                    <div className="flex flex-wrap gap-2">
                      {channels.map((ch) => (
                        <button
                          key={ch.source}
                          type="button"
                          aria-pressed={ch.on}
                          onClick={() =>
                            setChannels((prev) => prev.map((x) => (x.source === ch.source ? { ...x, on: !x.on } : x)))
                          }
                          className={pill(ch.on)}
                        >
                          {ch.on && <CheckIcon weight="bold" aria-hidden className="h-3.5 w-3.5" />}
                          {ch.official ? `${ch.source} (direct)` : ch.source}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 pl-5 text-[13.5px] tabular-nums text-[#44474d]">
                      {channels.filter((c) => c.on).length} of {channels.length} confirmed
                    </p>
                  </fieldset>
                )}

                {step === 1 && manual && (
                  <>
                    <Note>
                      {search === 'failed'
                        ? searchWhy
                        : details === 'failed'
                          ? detailsWhy
                          : chosen === null
                            ? 'No problem.'
                            : 'We did not find a match.'}{' '}
                      Paste your listing links instead.
                    </Note>
                    <Field id="direct" label="Direct website" value={a.direct} onChange={set('direct')} required type="url" placeholder="https://yourhotel.com" />
                    <Field id="expedia" label="Expedia listing" value={a.expedia} onChange={set('expedia')} type="url" placeholder="https://expedia.com/…" />
                    <Field id="booking" label="Booking.com listing" value={a.booking} onChange={set('booking')} type="url" placeholder="https://booking.com/hotel/…" />
                  </>
                )}

                {step === 2 &&
                  (rooms.length > 0 ? (
                    <ul className="grid gap-2">
                      {rooms.map((r) => (
                        <li
                          key={r.name}
                          className="grid min-h-[3.25rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[1.25rem] bg-white py-1.5 pl-5 pr-1.5 ring-1 ring-[#0b1c30]/[0.08] sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                        >
                          <span className="min-w-0">
                            <span title={r.name} className="line-clamp-2 text-[14.5px] leading-snug text-[#1a1b20]">
                              {r.name}
                            </span>
                            {r.price !== null && (
                              <span className="block font-geist-mono text-[12px] tabular-nums text-[#44474d] sm:hidden">
                                ${r.price}
                              </span>
                            )}
                          </span>
                          <span className="hidden w-12 text-right font-geist-mono text-[12.5px] tabular-nums text-[#44474d] sm:block">
                            {r.price !== null && `$${r.price}`}
                          </span>
                          <span
                            role="group"
                            aria-label={`Tier for ${r.name}`}
                            className="grid w-[10.5rem] grid-cols-2 rounded-full bg-[#0b1c30]/[0.06] p-1"
                          >
                            {TIERS.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                aria-pressed={r.tier === t.id}
                                onClick={() =>
                                  setRooms((prev) => prev.map((x) => (x.name === r.name ? { ...x, tier: t.id } : x)))
                                }
                                className={`rounded-full py-1.5 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-300 ${ring} ${
                                  r.tier === t.id
                                    ? 'bg-white text-[#085ac0] shadow-[0_1px_2px_rgba(11,28,48,0.08),0_4px_12px_-4px_rgba(11,28,48,0.12)] ring-1 ring-[#0b1c30]/[0.06]'
                                    : 'text-[#44474d] hover:text-[#0b1c30]'
                                }`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-[1.25rem] bg-[#0b1c30]/[0.05] p-5 text-[14.5px] leading-relaxed text-[#44474d]">
                      We could not read room types from your listings, so our team will map them with you. Everything
                      starts in the Standard tier until then.
                    </p>
                  ))}

                {step === 3 && (
                  <fieldset>
                    <legend className={LABEL}>{nearby.some((n) => !Number.isNaN(n.distanceMi)) ? 'Closest to you' : 'Your competitors'}</legend>
                    {nearby.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {nearby.map((n) => {
                          const on = a.competitors.includes(n.name);
                          return (
                            <button key={n.name} type="button" aria-pressed={on} onClick={() => toggle(n.name)} className={pill(on)}>
                              {on && <CheckIcon weight="bold" aria-hidden className="h-3.5 w-3.5" />}
                              {n.name}
                              {!Number.isNaN(n.distanceMi) && (
                                <span className="font-geist-mono text-[12px] tabular-nums opacity-70">{n.distanceMi} mi</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="relative mt-4">
                      <label className="sr-only" htmlFor="extra">
                        Add a hotel
                      </label>
                      <input
                        id="extra"
                        value={extra}
                        onChange={(e) => setExtra(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addExtra();
                          }
                        }}
                        placeholder="Add a hotel by name"
                        className={`${FIELD} pr-14`}
                      />
                      <button
                        type="button"
                        onClick={addExtra}
                        aria-label="Add hotel"
                        className={`absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#44474d] transition-colors duration-300 hover:bg-[#0b1c30]/[0.05] hover:text-[#0b1c30] ${ring}`}
                      >
                        <PlusIcon weight="light" aria-hidden className="h-[18px] w-[18px]" />
                      </button>
                    </div>
                    <p className="mt-3 pl-5 text-[13.5px] tabular-nums text-[#44474d]">{a.competitors.length} selected</p>
                  </fieldset>
                )}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className={`inline-flex items-center gap-2 rounded-full py-2 pl-3 pr-4 text-[14px] font-medium text-[#44474d] transition-colors duration-300 hover:bg-[#0b1c30]/[0.05] hover:text-[#0b1c30] ${ring}`}
                >
                  <ArrowLeftIcon weight="light" aria-hidden className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <span />
              )}
              <PillButton type="submit" disabled={blocked}>
                {last ? 'Open the dashboard' : 'Continue'}
              </PillButton>
            </div>
          </form>
        </div>

        <p className="text-[13px] text-[#44474d]">Recommendation only. Rate Radar never changes a price anywhere.</p>
      </section>

      <aside className="relative isolate hidden min-w-0 items-center justify-center overflow-hidden px-12 lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:self-start">
        <HeroRadar variant="auth" />
        <Readback a={a} channels={channels} rooms={rooms} />
      </aside>
    </main>
  );
}
