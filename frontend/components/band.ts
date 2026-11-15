/*
 * Demand vocabulary shared by the calendar, the event map, market intelligence
 * and the dashboard, so a Major night reads the same everywhere.
 */

import { tierOf } from '../../backend/lib/scoring/score';

export type Band = 'major' | 'meaningful' | 'minor' | 'quiet';

/** Demand band: the scoring engine's tier, with "too small" shown as quiet. */
export function band(score: number): Band {
  const t = tierOf(score);
  return t === 'too-small' ? 'quiet' : t;
}

/* Demand chips on a light surface, DESIGN.md → Chips. */
export const BAND_CHIP: Record<Band, { label: string; cls: string }> = {
  major: { label: 'Major', cls: 'bg-[#085ac0] text-white' },
  meaningful: { label: 'Meaningful', cls: 'bg-[#e5eeff] text-[#085ac0]' },
  minor: { label: 'Minor', cls: 'bg-[#1a1b20]/10 text-[#1a1b20]' },
  quiet: { label: 'Quiet', cls: 'bg-[#0b1c30]/[0.05] text-[#44474d]' },
};

export const KIND_LABEL: Record<string, string> = {
  convention: 'Conference',
  university: 'University',
  concert: 'Concert',
  sports: 'Sports',
  holiday: 'Holiday',
  other: 'Event',
};

/** Miles for display: one decimal under ten, whole miles after. */
export const fmtMi = (n: number) => (n < 10 ? n.toFixed(1) : Math.round(n).toString());
