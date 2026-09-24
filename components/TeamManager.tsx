'use client';
import { useCallback, useEffect, useState } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react/dist/ssr/CaretDown';
import { PaperPlaneTiltIcon } from '@phosphor-icons/react/dist/ssr/PaperPlaneTilt';
import { ReadOnlyNote, useCanWrite } from './RoleProvider';
import { PillButton } from './landing/Machined';
import type { Member, Role } from '../lib/auth/members';
import { FIELD, FOCUS, Footnote, MONO_LABEL, StatusChip, StatusLine, type Tone } from './settings/parts';

/**
 * Team tab: the invite list that gates magic-link sign-in. An owner adds an
 * email and a role; that address can then sign in from /login or /signup.
 * Everyone may see who is on the team; only an owner may change it.
 *
 * Owner reads in the cobalt accent, not red: red in this system means
 * something is broken (DESIGN.md → the Warn-Not-Fail Rule), and being the
 * owner is not a fault. Removing someone asks once, inline, before it happens.
 */

const ROLE_TONE: Record<Role, Tone> = { owner: 'accent', manager: 'quiet', viewer: 'quiet' };
const ROLE_HELP: Record<Role, string> = {
  viewer: 'Can see everything, change nothing.',
  manager: 'Can edit rates and baselines.',
  owner: 'Everything a manager can, plus the team.',
};

const initial = (email: string) => email.trim().charAt(0).toUpperCase() || '?';

export default function TeamManager() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [owner, setOwner] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [busy, setBusy] = useState(false);
  /** The member whose Remove was pressed once and now asks to confirm. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const isOwner = useCanWrite('owner');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/members').catch(() => null);
    if (res?.ok) {
      const json = (await res.json()) as { members: Member[]; ownerEmail: string | null };
      setMembers(json.members);
      setOwner(json.ownerEmail);
      setLoadFailed(false);
    } else if (!members) {
      setLoadFailed(true);
    }
  }, [members]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setNotice({ tone: 'ok', text: `${email} can now sign in with a magic link from the sign-in page.` });
        setEmail('');
      } else {
        setNotice({ tone: 'bad', text: json.error ?? 'The invite did not go through. Try again.' });
      }
    } catch {
      setNotice({ tone: 'bad', text: 'Could not reach the server, so nobody was invited. Check your connection.' });
    }
    await refresh();
    setBusy(false);
  }

  async function remove(target: string) {
    setBusy(true);
    setNotice(null);
    setConfirming(null);
    try {
      const res = await fetch('/api/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setNotice(
        res.ok
          ? { tone: 'ok', text: `${target} was removed and can no longer sign in.` }
          : { tone: 'bad', text: json.error ?? `${target} was not removed. Try again.` },
      );
    } catch {
      setNotice({ tone: 'bad', text: `Could not reach the server, so ${target} is still on the team.` });
    }
    await refresh();
    setBusy(false);
  }

  const rows: { email: string; role: Role; fixed?: boolean }[] = [
    ...(owner ? [{ email: owner, role: 'owner' as Role, fixed: true }] : []),
    ...(members ?? []).filter((m) => m.email !== owner),
  ];

  return (
    <div className="space-y-6">
      {members === null && !loadFailed ? (
        <div aria-busy="true" aria-label="Loading team" className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-[1rem] bg-[#0b1c30]/[0.05] motion-safe:animate-pulse" />
          ))}
        </div>
      ) : loadFailed ? (
        <p className="rounded-[1.25rem] bg-[#0b1c30]/[0.05] px-5 py-4 text-[14.5px] text-[#44474d]">
          The team list could not be loaded. Reload the page to try again.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-[1.25rem] bg-[#0b1c30]/[0.05] px-5 py-4 text-[14.5px] leading-relaxed text-[#44474d]">
          Nobody is on the team yet. Set <span className="font-geist-mono text-[13px]">OWNER_EMAIL</span> for the first
          owner, then invite teammates below.
        </p>
      ) : (
        <ul className="divide-y divide-[#0b1c30]/[0.06] rounded-[1.25rem] bg-[#0b1c30]/[0.035] px-4">
          {rows.map((m) => (
            <li key={m.email} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
              <span
                aria-hidden
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold ${
                  m.role === 'owner' ? 'bg-[#085ac0] text-white' : 'bg-white text-[#0b1c30] ring-1 ring-[#0b1c30]/[0.08]'
                }`}
              >
                {initial(m.email)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium">{m.email}</span>
                <span className="block text-[12.5px] text-[#44474d]">
                  {m.fixed ? 'Set by OWNER_EMAIL, so it cannot be removed here.' : ROLE_HELP[m.role]}
                </span>
              </span>
              <StatusChip tone={ROLE_TONE[m.role]}>{m.role[0].toUpperCase() + m.role.slice(1)}</StatusChip>
              {isOwner && !m.fixed && (
                confirming === m.email ? (
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(m.email)}
                      className={`h-8 rounded-full bg-[#ba1a1a] px-3.5 text-[13px] font-medium text-white transition-[background-color,transform] duration-200 hover:bg-[#9c1515] active:scale-[0.97] disabled:opacity-60 ${FOCUS}`}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className={`h-8 rounded-full px-3 text-[13px] font-medium text-[#44474d] transition-colors duration-200 hover:bg-[#0b1c30]/[0.06] hover:text-[#1a1b20] ${FOCUS}`}
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirming(m.email)}
                    aria-label={`Remove ${m.email}`}
                    className={`h-8 rounded-full bg-white px-3.5 text-[13px] font-medium text-[#0b1c30] ring-1 ring-[#0b1c30]/[0.1] transition-[background-color,transform] duration-200 hover:bg-[#f3f5fc] active:scale-[0.97] disabled:opacity-60 ${FOCUS}`}
                  >
                    Remove
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner ? (
        <form onSubmit={invite} className="space-y-2">
          <p className="text-[14.5px] font-medium">Invite a teammate</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <label htmlFor="invite-email" className="sr-only">
                Email address
              </label>
              <input
                id="invite-email"
                className={FIELD}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@yourhotel.com"
                required
              />
            </div>
            <label className="relative block sm:w-40">
              <span className="sr-only">Role</span>
              <select
                className={`${FIELD} cursor-pointer appearance-none pr-10`}
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="viewer">Viewer</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
              <CaretDownIcon
                weight="light"
                aria-hidden
                className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#44474d]"
              />
            </label>
            <PillButton type="submit" disabled={busy || !email.trim()} icon={<PaperPlaneTiltIcon weight="light" className="h-4 w-4" />}>
              Invite
            </PillButton>
          </div>
          <p className={MONO_LABEL}>{ROLE_HELP[role]}</p>
        </form>
      ) : (
        <ReadOnlyNote what="Inviting and removing teammates" required="owner" />
      )}

      <StatusLine status={notice} />

      <Footnote>
        Invited addresses sign in by magic link. On Resend&apos;s free tier, with no verified domain, links only reach
        the Resend account owner&apos;s own address; verify a domain to invite anyone else.
      </Footnote>
    </div>
  );
}
