/**
 * The one HTML shell every Rate Radar email is built from: alert digests, the
 * pipeline heartbeat and magic-link sign-in. Same language as the product
 * (DESIGN.md): a cold-daylight canvas, one double-bezel panel, Signal Cobalt
 * only on the single action, the radar mark on a cobalt tile.
 *
 * Email-client rules this file follows on purpose:
 *  - tables and inline styles only (Gmail drops <style> for many clients);
 *    the <style> block carries nothing but the dark-mode overrides
 *  - no SVG (Gmail strips it) — the mark is a PNG served by app/email-mark.png
 *  - every string that came from a feed is escaped before it lands in markup
 */

export const EMAIL_COLORS = {
  cobalt: '#085AC0',
  cobaltWash: '#E5EEFF',
  navy: '#0B1C30',
  canvas: '#F8F9FF',
  shell: '#EDF0F7',
  white: '#FFFFFF',
  ink: '#1A1B20',
  muted: '#44474D',
  hairline: '#DDE1EA',
  well: '#F3F5FA',
  warn: '#B45309',
  warnWash: '#FDF3E7',
  ok: '#029768',
} as const;

const C = EMAIL_COLORS;
const FONT = `Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Absolute URL of the PNG mark, or null when there is no public origin to host it. */
export function markUrl(origin: string | undefined | null): string | null {
  if (!origin) return null;
  return `${origin.replace(/\/$/, '')}/email-mark.png`;
}

export interface EmailShellInput {
  /** Inbox preview text, shown after the subject line. */
  preheader: string;
  heading: string;
  /** Plain sentence(s) under the heading; escaped here. */
  intro: string;
  /** Optional status chip above the heading, e.g. "Needs attention". */
  status?: { label: string; tone: 'warn' | 'ok' };
  /** Pre-built, already-escaped HTML for the panel body. */
  bodyHtml?: string;
  cta?: { label: string; href: string };
  /** Pre-built, already-escaped HTML placed under the button. */
  afterCtaHtml?: string;
  /** Small print under the button inside the panel; escaped here. */
  note?: string;
  /** Footer line explaining why this email arrived; escaped here. */
  reason: string;
  /** Public origin used to load the mark image. */
  origin?: string | null;
}

export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
  <tr><td class="rr-btn" bgcolor="${C.cobalt}" style="background:${C.cobalt};border-radius:999px;">
    <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:${C.white};text-decoration:none;border-radius:999px;">${esc(label)}</a>
  </td></tr>
</table>`;
}

export function emailShell(input: EmailShellInput): string {
  const mark = markUrl(input.origin);
  const logo = mark
    ? `<img src="${esc(mark)}" width="28" height="28" alt="" style="display:block;border:0;width:28px;height:28px;border-radius:7px;">`
    : '';

  const status = input.status
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border-collapse:separate;"><tr>
        <td style="background:${input.status.tone === 'warn' ? C.warnWash : '#E3F5EE'};border-radius:999px;padding:3px 11px;font-family:${FONT};font-size:12px;font-weight:500;line-height:18px;color:${input.status.tone === 'warn' ? C.warn : C.ok};">${esc(input.status.label)}</td>
      </tr></table>`
    : '';

  const cta = input.cta
    ? `<tr><td style="padding:28px 0 0;">${button(input.cta.label, input.cta.href)}</td></tr>`
    : '';

  const note = input.note
    ? `<tr><td class="rr-muted" style="padding:20px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};">${esc(input.note)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(input.heading)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .rr-canvas { background:#0B1320 !important; }
    .rr-shell { background:#16233A !important; }
    .rr-core { background:#0F1A2B !important; }
    .rr-well { background:#16233A !important; }
    .rr-title, .rr-word { color:#EEF2FA !important; }
    .rr-text { color:#D5DBE6 !important; }
    .rr-muted { color:#9BA6B8 !important; }
    .rr-bar { background:#33415A !important; }
  }
  @media only screen and (max-width: 600px) {
    .rr-pad { padding:28px 22px !important; }
    .rr-gutter { padding-left:12px !important; padding-right:12px !important; }
  }
</style>
</head>
<body class="rr-canvas" style="margin:0;padding:0;background:${C.canvas};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(input.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="rr-canvas" bgcolor="${C.canvas}" style="background:${C.canvas};">
  <tr><td align="center" class="rr-gutter" style="padding:40px 16px 48px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <tr><td style="padding:0 8px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          ${logo ? `<td style="padding-right:10px;vertical-align:middle;">${logo}</td>` : ''}
          <td class="rr-word" style="vertical-align:middle;font-family:${FONT};font-size:17px;font-weight:700;letter-spacing:-0.01em;color:${C.navy};">Rate Radar</td>
        </tr></table>
      </td></tr>
      <tr><td class="rr-shell" style="background:${C.shell};border-radius:26px;padding:6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="rr-core" bgcolor="${C.white}" style="background:${C.white};border-radius:20px;">
          <tr><td class="rr-pad" style="padding:36px 36px 34px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td>${status}<h1 class="rr-title" style="margin:0;font-family:${FONT};font-size:24px;font-weight:600;line-height:32px;letter-spacing:-0.01em;color:${C.navy};">${esc(input.heading)}</h1></td></tr>
              <tr><td class="rr-text" style="padding:10px 0 0;font-family:${FONT};font-size:15px;line-height:24px;color:${C.muted};">${esc(input.intro)}</td></tr>
              ${input.bodyHtml ? `<tr><td style="padding:24px 0 0;">${input.bodyHtml}</td></tr>` : ''}
              ${cta}
              ${input.afterCtaHtml ? `<tr><td style="padding:28px 0 0;">${input.afterCtaHtml}</td></tr>` : ''}
              ${note}
            </table>
          </td></tr>
        </table>
      </td></tr>
      <tr><td class="rr-muted" style="padding:24px 8px 0;font-family:${FONT};font-size:12px;line-height:19px;color:${C.muted};">
        Rate Radar recommends. It never changes a price anywhere. A human decides.<br>
        ${esc(input.reason)}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/**
 * A titled group of plain-sentence rows inside a tinted well. `accent` draws
 * a thin bar down the left edge: warn for data-health rows, cobalt nowhere by
 * default (the button is the only verdict in an email).
 */
export function section(title: string, rows: string[], accent?: 'warn'): string {
  const bar = accent === 'warn' ? C.warn : C.hairline;
  const items = rows
    .map(
      (r, i) => `<tr><td style="padding:${i === 0 ? '0' : '12px'} 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="3" class="${accent === 'warn' ? '' : 'rr-bar'}" style="width:3px;background:${bar};border-radius:3px;font-size:0;line-height:0;">&nbsp;</td>
          <td class="rr-text" style="padding:1px 0 1px 12px;font-family:${FONT};font-size:14px;line-height:22px;color:${C.ink};">${esc(r)}</td>
        </tr></table>
      </td></tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
  <tr><td class="rr-well" style="background:${C.well};border-radius:14px;padding:16px 18px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="rr-title" style="padding:0 0 10px;font-family:${FONT};font-size:13px;font-weight:600;line-height:18px;color:${C.navy};">${esc(title)}</td></tr>
      ${items}
    </table>
  </td></tr>
</table>`;
}

/** A monospace URL box, for the "button doesn't work" fallback. */
export function linkFallback(url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td class="rr-muted" style="font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};padding:0 0 6px;">If the button doesn't work, paste this into your browser:</td></tr>
  <tr><td class="rr-well rr-text" style="background:${C.well};border-radius:10px;padding:10px 12px;font-family:'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;font-size:12px;line-height:18px;color:${C.ink};word-break:break-all;">${esc(url)}</td></tr>
</table>`;
}
