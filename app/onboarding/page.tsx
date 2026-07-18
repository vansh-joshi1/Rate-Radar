const STEPS = [
  { n: 1, label: 'Property', state: 'complete' },
  { n: 2, label: 'Listings', state: 'active' },
  { n: 3, label: 'Competitors', state: 'todo' },
] as const;

export default function Onboarding() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 py-12">
      <div className="mb-10 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
        Rate Radar
      </div>

      <div className="relative mb-14 flex justify-between">
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-line" />
        {STEPS.map((s) => (
          <div key={s.n} className="relative z-10">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                s.state === 'complete'
                  ? 'border-accent bg-accent text-white'
                  : s.state === 'active'
                    ? 'border-accent bg-card text-accent'
                    : 'border-line bg-paper text-muted'
              }`}
            >
              {s.state === 'complete' ? '✓' : s.n}
            </div>
            <div
              className={`absolute left-1/2 top-10 -translate-x-1/2 whitespace-nowrap text-xs font-semibold ${
                s.state === 'active' ? 'text-ink' : 'text-muted'
              }`}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="mb-2 text-2xl font-bold tracking-tight">Connect your listings</h2>
        <p className="mb-6 text-sm text-muted">
          Paste the URLs to your property&apos;s public pages. We use these to monitor rate parity — best-effort against
          bot-protected pages, so &quot;needs manual check&quot; now and then is expected, not failure.
        </p>
        {/* Demo flow: persists once onboarding is wired to per-property config. */}
        <form action="/overview">
          <div className="mb-4">
            <label className="label" htmlFor="direct">Direct website URL</label>
            <input id="direct" type="url" className="field" placeholder="https://redroof-franklin.com" defaultValue="https://redroof-franklin.com" />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="expedia">Expedia listing URL</label>
            <input id="expedia" type="url" className="field" placeholder="https://expedia.com/h12345" />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="booking">Booking.com listing URL</label>
            <input id="booking" type="url" className="field" placeholder="https://booking.com/hotel/us/red-roof-franklin.html" />
          </div>
          <div className="mt-8 flex justify-between">
            <button type="button" className="btn">Back</button>
            <button type="submit" className="btn btn-primary">Continue to step 3</button>
          </div>
        </form>
      </div>
    </main>
  );
}
