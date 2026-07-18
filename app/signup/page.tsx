import Link from 'next/link';

export default function Signup() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-5 text-ink">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          Rate Radar
        </Link>
        <div className="card p-8">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">Start your 14-day trial</h2>
          {/* Demo flow: account creation lands when real auth (NextAuth) replaces the site password. */}
          <form action="/onboarding">
            <div className="mb-4">
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" name="name" type="text" className="field" placeholder="Priya Patel" required />
            </div>
            <div className="mb-4">
              <label className="label" htmlFor="email">Work email</label>
              <input id="email" name="email" type="email" className="field" placeholder="priya@hotel.com" required />
            </div>
            <div className="mb-5">
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" className="field" required />
            </div>
            <button type="submit" className="btn btn-primary w-full py-3">Create account</button>
          </form>
          <p className="mt-4 text-center text-xs text-muted">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account? <Link href="/login" className="font-semibold text-accent">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
