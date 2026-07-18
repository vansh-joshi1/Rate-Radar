'use client';
import { useCallback, useEffect, useState } from 'react';
import { Chip } from './ui';
import type { Member, Role } from '../lib/auth/members';

/**
 * Team tab — the invite list that gates magic-link sign-in. Owner adds an
 * email + role; that address can then sign in from /login or /signup.
 */
export default function TeamManager() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/members');
    if (res.ok) {
      const json = (await res.json()) as { members: Member[]; ownerEmail: string | null };
      setMembers(json.members);
      setOwner(json.ownerEmail);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) {
      setNotice({ tone: 'ok', text: `${email} can now sign in with a magic link from the login page.` });
      setEmail('');
    } else {
      setNotice({ tone: 'bad', text: json.error ?? 'invite failed' });
    }
    await refresh();
    setBusy(false);
  }

  async function remove(target: string) {
    setBusy(true);
    setNotice(null);
    const res = await fetch('/api/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: target }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) setNotice({ tone: 'bad', text: json.error ?? 'remove failed' });
    await refresh();
    setBusy(false);
  }

  return (
    <div className="max-w-2xl">
      <div className="card mb-4 p-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr><th className="th">Member</th><th className="th">Role</th><th className="th" /></tr>
          </thead>
          <tbody>
            {owner && (
              <tr>
                <td className="td font-semibold">{owner}</td>
                <td className="td"><Chip tone="bad">Owner</Chip></td>
                <td className="td text-right text-xs text-muted">OWNER_EMAIL</td>
              </tr>
            )}
            {(members ?? []).map((m) => (
              <tr key={m.email} className="hover:bg-ink/[0.03]">
                <td className="td">{m.email}</td>
                <td className="td"><Chip tone={m.role === 'owner' ? 'bad' : 'neutral'}>{m.role}</Chip></td>
                <td className="td text-right">
                  <button className="btn btn-sm" disabled={busy} onClick={() => remove(m.email)}>remove</button>
                </td>
              </tr>
            ))}
            {members !== null && members.length === 0 && !owner && (
              <tr><td colSpan={3} className="td text-muted">No members yet — set OWNER_EMAIL and invite teammates below.</td></tr>
            )}
            {members === null && (
              <tr><td colSpan={3} className="td text-muted">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={invite} className="flex flex-wrap gap-2">
        <input
          className="field max-w-xs"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@hotel.com"
          required
        />
        <select className="field w-32" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="viewer">viewer</option>
          <option value="manager">manager</option>
          <option value="owner">owner</option>
        </select>
        <button type="submit" className="btn btn-primary" disabled={busy}>Invite</button>
      </form>
      {notice && <p className={`mt-3 text-sm ${notice.tone === 'ok' ? 'text-ok' : 'text-bad'}`}>{notice.text}</p>}
      <p className="mt-3 text-xs text-muted">
        Invited emails sign in via magic link. Note: on Resend&apos;s free tier (no verified domain), links only
        deliver to the Resend account owner&apos;s address — verify a domain to invite anyone.
      </p>
    </div>
  );
}
