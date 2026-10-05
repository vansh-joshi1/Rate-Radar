import { describe, it, expect } from 'vitest';
import { alertDigestEmail, pipelineStaleEmail, salesInquiryEmail, signInEmail } from '../lib/email/messages';
import type { Trigger } from '../lib/alerts/rules';

const TRIGGERS: Trigger[] = [
  { type: 'source-health', line: 'ticketmaster failing since 2026-09-20' },
  { type: 'new-event', date: '2026-09-26', line: 'Titans vs <Colts>, Sat, Sep 26', event: 'Titans vs <Colts>' },
  { type: 'rate-change', date: '2026-09-27', line: 'Sun, Sep 27: $90, was $96', rate: { now: 90, was: 96 } },
  { type: 'rate-change', date: '2026-09-26', line: 'Sat, Sep 26: $112, was $94', rate: { now: 112, was: 94, driver: 'Titans vs <Colts>' } },
  { type: 'new-event', date: '2026-10-02', line: 'Fall Fest, Fri, Oct 2', event: 'Fall Fest' },
  { type: 'parity-gap', line: 'Parity: expedia $89 vs booking $109, $20 spread' },
];

describe('alertDigestEmail', () => {
  const msg = alertDigestEmail(TRIGGERS, 'https://rr.example.com/');

  it('leads the subject and headline with the biggest move, and counts the rest', () => {
    // 2 nights + parity + Fall Fest + data = 5 items; the lead is one of them.
    expect(msg.subject).toBe('Sat, Sep 26 → $112 (+$18) · 4 more');
    expect(msg.html).toContain('Raise Sat, Sep 26 to $112');
    expect(msg.text.split('\n')[0]).toBe('Raise Sat, Sep 26 to $112');
  });

  it('lists nights in date order and folds the driving event into its row', () => {
    expect(msg.text).toContain('Sat, Sep 26  $112  was $94  Titans vs <Colts>');
    expect(msg.text.indexOf('Sat, Sep 26  $112')).toBeLessThan(msg.text.indexOf('Sun, Sep 27  $90'));
    expect(msg.text).not.toContain('Titans vs <Colts>, Sat, Sep 26');
  });

  it('puts parity before other events under Also, and data after the button', () => {
    expect(msg.text.indexOf('Parity:')).toBeLessThan(msg.text.indexOf('Fall Fest'));
    expect(msg.html.indexOf('Open dashboard')).toBeLessThan(msg.html.indexOf('Data: ticketmaster failing'));
  });

  it('escapes feed text', () => {
    expect(msg.html).toContain('Titans vs &lt;Colts&gt;');
    expect(msg.html).not.toContain('<Colts>');
  });

  it('without a rate move, heads with the first item and does not list it twice', () => {
    const quiet = alertDigestEmail(TRIGGERS.filter((t) => t.type !== 'rate-change'));
    expect(quiet.subject).toBe('Parity: expedia $89 vs booking $109, $20 spread · 3 more');
    expect(quiet.text.split('Parity:').length).toBe(2);
  });

  it('with only data problems, says so', () => {
    expect(alertDigestEmail([TRIGGERS[0]]).subject).toBe('Data problem: ticketmaster failing since 2026-09-20');
  });

  it('drops the button and the mark when there is no dashboard URL', () => {
    const bare = alertDigestEmail(TRIGGERS);
    expect(bare.html).not.toContain('Open dashboard');
    expect(bare.html).not.toContain('email-mark.png');
  });
});

describe('pipelineStaleEmail', () => {
  it('states the stale age and links to Actions', () => {
    const msg = pipelineStaleEmail({
      ageHours: 26.4,
      staleAfterHours: 20,
      reason: 'GITHUB_DISPATCH_TOKEN is not set.',
      actionsUrl: 'https://github.com/o/r/actions',
    });
    expect(msg.html).toContain('26 hours');
    expect(msg.html).toContain('href="https://github.com/o/r/actions"');
    expect(msg.html).toContain('20 hours');
  });
});

describe('signInEmail', () => {
  it('uses the link origin for the mark and escapes the link', () => {
    const url = 'https://rr.example.com/api/auth/callback/resend?token=a&email=b%40c.com';
    const msg = signInEmail({ url, email: 'b@c.com' });
    expect(msg.html).toContain('https://rr.example.com/email-mark.png');
    expect(msg.html).toContain('token=a&amp;email=');
    expect(msg.text).toContain(url);
  });
});

describe('salesInquiryEmail', () => {
  it('carries every field and escapes what the visitor typed', () => {
    const msg = salesInquiryEmail({ name: 'Jo <b>Lee</b>', email: 'jo@hotels.com', phone: '555 010 2030', properties: 12, details: 'Uses <script>x</script>' });
    expect(msg.subject).toContain('12 properties');
    expect(msg.html).toContain('Jo &lt;b&gt;Lee&lt;/b&gt;');
    expect(msg.html).not.toContain('<script>');
    expect(msg.text).toContain('Phone: 555 010 2030');
    expect(msg.text).toContain('Email: jo@hotels.com');
  });
});
