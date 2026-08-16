'use client';
import { createContext, useContext } from 'react';
import { roleAtLeast, type Role } from '../lib/auth/roles';

/**
 * The signed-in member's role, handed down from the server layout so client
 * components can hide controls the server would refuse anyway.
 *
 * This is presentation only — never a security boundary. Every write is
 * enforced again in the route handler via requireRole; hiding a button just
 * spares a viewer a pointless 403.
 *
 * Defaults to 'viewer' with no provider: least privilege if it's ever missed.
 */
const RoleContext = createContext<Role>('viewer');

export function RoleProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): Role {
  return useContext(RoleContext);
}

/** True when the member meets `required` — same policy the server applies. */
export function useCanWrite(required: Role = 'manager'): boolean {
  return roleAtLeast(useContext(RoleContext), required);
}

/** Standard explanation shown where a control would otherwise be. */
export function ReadOnlyNote({ what, required = 'manager' }: { what: string; required?: Role }) {
  return (
    <p className="text-xs text-muted">
      Your account is view-only. {what} needs the <strong>{required}</strong> role — ask an owner in Settings → Team.
    </p>
  );
}
