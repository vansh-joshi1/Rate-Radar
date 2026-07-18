import Link from 'next/link';

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[#c8102e] focus:ring-2 focus:ring-[#c8102e]/20';

export default function Signup() {
  return (
    <main className="font-inter flex min-h-screen items-center justify-center bg-[#f5f4f0] p-5 text-slate-900">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#c8102e]" />
          Rate Radar
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">Start your 14-day trial</h2>
          {/* Demo flow: account creation lands when real auth (NextAuth) replaces the site password. */}
          <form action="/onboarding">
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-semibold" htmlFor="name">Full name</label>
              <input id="name" name="name" type="text" className={field} placeholder="Priya Patel" required />
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-semibold" htmlFor="email">Work email</label>
              <input id="email" name="email" type="email" className={field} placeholder="priya@hotel.com" required />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-semibold" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" className={field} required />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-[#c8102e] py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#a00d25]"
            >
              Create account
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[#c8102e]">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
