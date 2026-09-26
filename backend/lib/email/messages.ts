import type { Trigger } from '../alerts/rules';
import { fmtDowDay } from '../date';
import { emailShell, linkFallback, section } from './template';

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

const FOOTER_TEXT = 'Rate Radar recommends. It never changes a price anywhere. A human decides.';

/**
 * Trigger lines are written once in lib/alerts/rules.ts and shown in more than
 * one place. In email they read better as one sentence, so the spaced dash the
 * rules use as a joiner becomes a comma here.
 */
function tidy(line: string): string {
  return line.replace(/\s+—\s+/g, ', ');
}

const GROUPS: { title: string; types: Trigger['type'][]; accent?: 'warn' }[] = [
  { title: 'Rate changes', types: ['rate-change'] },
  { title: 'New demand', types: ['new-event'] },
  { title: 'Holidays ahead', types: ['holiday'] },
  { title: 'Weather', types: ['weather'] },
  { title: 'Rate parity', types: ['parity-gap'] },
  { title: 'Data health', types: ['source-health', 'search-budget'], accent: 'warn' },
];

export function alertDigestEmail(triggers: Trigger[], dashboardUrl?: string): EmailMessage {
  const base = dashboardUrl?.replace(/\/$/, '') || undefined;
  const n = triggers.length;
  const firstDate = triggers.find((t) => t.date)?.date;
  const subject = `Rate Radar: ${n} update${n === 1 ? '' : 's'}${firstDate ? ` · ${fmtDowDay(firstDate)}` : ''}`;

  const groups = GROUPS.map((g) => ({ ...g, lines: triggers.filter((t) => g.types.includes(t.type)).map((t) => tidy(t.line)) }))
    .filter((g) => g.lines.length > 0);

  const heading = n === 1 ? 'One thing worth a look' : `${n} things worth a look`;
  const intro =
    'These changed since the last alert. Nothing has been changed on any channel; the reasoning for each night is on the dashboard.';

  const html = emailShell({
    preheader: tidy(triggers[0]?.line ?? heading),
    heading,
    intro,
    bodyHtml: groups.map((g) => section(g.title, g.lines, g.accent)).join(''),
    cta: base ? { label: 'Open dashboard', href: `${base}/overview` } : undefined,
    reason: 'You get this when an alert rule fires, never on a quiet run. Thresholds are in Settings > Notifications.',
    origin: base,
  });

  const text = [
    heading,
    '',
    ...groups.flatMap((g) => [g.title, ...g.lines.map((l) => `  • ${l}`), '']),
    base ? `Full reasoning: ${base}/overview` : '',
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
