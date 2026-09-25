/**
 * Password rules for the account an access request creates. One list, read by
 * the onboarding checklist (ticks green as you type) and by the server schema
 * (lib/access-requests.ts), so the two cannot disagree.
 */
export const PASSWORD_RULES: { label: string; test: (pw: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'A letter', test: (pw) => /[A-Za-z]/.test(pw) },
  { label: 'A number', test: (pw) => /\d/.test(pw) },
  { label: 'A special character', test: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
];

export const passwordOk = (pw: string) => PASSWORD_RULES.every((r) => r.test(pw));
