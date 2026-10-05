import type { Trigger } from '../alerts/rules';
import { fmtDowDay } from '../date';
import { emailShell, esc, linkFallback, nightsTable, section } from './template';
import { PLAN_LIMITS } from '../billing/plans';

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

const FOOTER_TEXT = 'Rate Radar recommends. It never changes a price anywhere. A human decides.';

/** Shown under the nights, in this order. Data problems go in the small print instead. */
const ALSO: Trigger['type'][] = ['parity-gap', 'new-event', 'weather', 'holiday'];
const DATA: Trigger['type'][] = ['source-health', 'search-budget'];

/**
 * The biggest rate move leads the subject and the headline; each night that moved is
 * one row; everything else is one short line. An event that drove a night's move is
 * shown in that night's row, not again underneath.
 */
export function alertDigestEmail(triggers: Trigger[], dashboardUrl?: string): EmailMessage {
  const base = dashboardUrl?.replace(/\/$/, '') || undefined;

  const moves = triggers
    .filter((t): t is Trigger & { date: string; rate: NonNullable<Trigger['rate']> } => Boolean(t.rate && t.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const moveOn = new Map(moves.map((t) => [t.date, t]));
  const folded = (t: Trigger) =>
    t.type === 'new-event' && t.date !== undefined && moveOn.has(t.date) && (moveOn.get(t.date)!.rate.driver ?? t.event) === t.event;
  const rows = moves.map((t) => ({
    date: fmtDowDay(t.date),
    now: t.rate.now,
    was: t.rate.was,
    why: t.rate.driver ?? triggers.find((e) => folded(e) && e.date === t.date)?.event,
  }));
  const also = ALSO.flatMap((type) => triggers.filter((t) => t.type === type && !folded(t))).map((t) => t.line);
  const data = triggers.filter((t) => DATA.includes(t.type)).map((t) => t.line);

  const top = moves.reduce<(typeof moves)[number] | undefined>(
    (best, t) => (!best || Math.abs(t.rate.now - t.rate.was) > Math.abs(best.rate.now - best.rate.was) ? t : best),
    undefined,
  );
  const heading = top
    ? `${top.rate.now > top.rate.was ? 'Raise' : 'Lower'} ${fmtDowDay(top.date)} to $${top.rate.now}`
    : also[0] ?? `Data problem: ${data[0]}`;
  // Without a rate move the first "also" line is the headline, so it is not listed twice.
  const listed = top ? also : also.slice(1);
  const others = rows.length + also.length + data.length - 1;
  const lead = top
    ? `${fmtDowDay(top.date)} → $${top.rate.now} (${top.rate.now > top.rate.was ? '+' : '-'}$${Math.abs(top.rate.now - top.rate.was)})`
    : heading;
  const subject = `${lead}${others > 0 ? ` · ${others} more` : ''}`;
  const dataNote = data.length ? `Data: ${data.join(' · ')}` : undefined;

  const html = emailShell({
    preheader: [...listed, ...data].join(' · ') || heading,
    heading,
    bodyHtml: (rows.length ? nightsTable(rows) : '') + (listed.length ? section('Also', listed) : ''),
    cta: base ? { label: 'Open dashboard', href: `${base}/overview` } : undefined,
    note: dataNote,
    reason: 'You get this when an alert rule fires, never on a quiet run. Thresholds are in Settings > Notifications.',
    origin: base,
  });

  const text = [
    heading,
    '',
    ...rows.map((r) => `${r.date}  $${r.now}  was $${r.was}${r.why ? `  ${r.why}` : ''}`),
    ...(rows.length ? [''] : []),
    ...(listed.length ? ['Also', ...listed.map((l) => `  • ${l}`), ''] : []),
    base ? `Dashboard: ${base}/overview` : '',
    ...(dataNote ? ['', dataNote] : []),
    '',
    FOOTER_TEXT,
  ].join('\n');

  return { subject, html, text };
}

export function pipelineStaleEmail(opts: {
  ageHours: number;
  staleAfterHours: number;
  reason: string;
  actionsUrl: string;
  origin?: string;
}): EmailMessage {
  const hours = Math.round(opts.ageHours);
  const subject = 'Rate Radar: collection has stopped';
  const heading = 'Collection has stopped';
  const intro = `No new data has arrived for ${hours} hours, and the heartbeat couldn't restart the collector. Recommendations are still showing, but they're built on old readings.`;

  const html = emailShell({
    preheader: `No new data for ${hours} hours. The collector needs a manual restart.`,
    status: { label: 'Needs attention', tone: 'warn' },
    heading,
    intro,
    bodyHtml: section('Why the restart failed', [opts.reason], 'warn'),
    cta: { label: 'Open GitHub Actions', href: opts.actionsUrl },
    note: 'Run the "collect" workflow by hand. The next scheduled run will pick up from there.',
    reason: `Sent by the heartbeat check when collection goes quiet for ${opts.staleAfterHours} hours.`,
    origin: opts.origin,
  });

  const text = [heading, '', intro, '', `Why: ${opts.reason}`, '', `GitHub Actions: ${opts.actionsUrl}`, '', FOOTER_TEXT].join('\n');
  return { subject, html, text };
}

export function signInEmail(opts: { url: string; email: string }): EmailMessage {
  const origin = new URL(opts.url).origin;
  const subject = 'Your Rate Radar sign-in link';
  const heading = 'Sign in to Rate Radar';
  const intro = `Use the button below to sign in as ${opts.email}. The link works once and expires in 24 hours.`;

  const html = emailShell({
    preheader: 'Your sign-in link. It works once and expires in 24 hours.',
    heading,
    intro,
    cta: { label: 'Sign in', href: opts.url },
    afterCtaHtml: linkFallback(opts.url),
    reason: "If you didn't ask to sign in, you can ignore this email. Nobody gets in without the link.",
    origin,
  });

  const text = [heading, '', intro, '', opts.url, '', "If you didn't ask to sign in, ignore this email."].join('\n');
  return { subject, html, text };
}

/** Sent when an access request is approved: the account the owner made at /onboarding now signs in. */
export function verifiedEmail(opts: { loginUrl: string; hotelName: string }): EmailMessage {
  const origin = new URL(opts.loginUrl).origin;
  const subject = `${opts.hotelName} is verified on Rate Radar`;
  const heading = "You're verified";
  const intro = `${opts.hotelName} is set up. Sign in with the email and password you chose when you requested access. The first rates arrive after the next collection run, within about half a day.`;

  const html = emailShell({
    preheader: 'Your access request was approved. Sign in with the password you chose.',
    heading,
    intro,
    status: { label: 'Approved', tone: 'ok' },
    cta: { label: 'Sign in', href: opts.loginUrl },
    afterCtaHtml: linkFallback(opts.loginUrl),
    reason: 'You requested access to Rate Radar for this hotel.',
    origin,
  });

  const text = [heading, '', intro, '', opts.loginUrl, '', FOOTER_TEXT].join('\n');
  return { subject, html, text };
}

/** Sent when a hotel's watchlist is trimmed to its plan's cap. */
export function compsTrimmedEmail(opts: { hotelName: string; removed: string[]; max: number; dashboardUrl?: string }): EmailMessage {
  const base = opts.dashboardUrl?.replace(/\/$/, '') || undefined;
  const subject = `Rate Radar: ${opts.hotelName} now tracks ${opts.max} competitors`;
  const heading = `Now tracking ${opts.max} competitors`;
  const intro = `${opts.hotelName}'s plan tracks up to ${opts.max} competitors, so we kept the ${opts.max} you added first and stopped tracking the rest.${opts.max < PLAN_LIMITS.growth.maxComps ? ` Growth tracks ${PLAN_LIMITS.growth.maxComps}.` : ''}`;

  const html = emailShell({
    preheader: `We stopped tracking ${opts.removed.length} competitor${opts.removed.length === 1 ? '' : 's'}.`,
    heading,
    intro,
    bodyHtml: section('No longer tracked', opts.removed),
    cta: base ? { label: 'Open competitors', href: `${base}/competitors` } : undefined,
    reason: "You're an owner of this hotel on Rate Radar, and it was tracking more competitors than its plan includes.",
    origin: base,
  });

  const text = [heading, '', intro, '', 'No longer tracked:', ...opts.removed.map((n) => `  • ${n}`), '', FOOTER_TEXT].join('\n');
  return { subject, html, text };
}

/** Sent to OWNER_EMAIL when someone asks about Enterprise from the pricing section. */
export function salesInquiryEmail(opts: { name: string; email: string; phone: string; properties: number; details: string }): EmailMessage {
  const subject = `Enterprise inquiry: ${opts.name}, ${opts.properties} properties`;
  const heading = 'New Enterprise inquiry';
  const rows: [string, string][] = [
    ['Name', opts.name],
    ['Email', opts.email],
    ['Phone', opts.phone],
    ['Properties', String(opts.properties)],
  ];

  const html = emailShell({
    preheader: `${opts.name} asked about Enterprise for ${opts.properties} properties.`,
    heading,
    intro: 'Someone filled in the Contact us form on the pricing section.',
    bodyHtml:
      rows.map(([k, v]) => `<p style="margin:0 0 8px"><strong>${k}:</strong> ${esc(v)}</p>`).join('') +
      (opts.details ? `<p style="margin:16px 0 0;white-space:pre-wrap">${esc(opts.details)}</p>` : ''),
    reason: 'You are the Rate Radar owner, so Enterprise inquiries come to you.',
  });

  const text = [heading, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', opts.details, '', FOOTER_TEXT].join('\n');
  return { subject, html, text };
}
