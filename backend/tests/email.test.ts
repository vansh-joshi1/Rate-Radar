import { describe, it, expect } from 'vitest';
import { alertDigestEmail, pipelineStaleEmail, signInEmail } from '../lib/email/messages';
import type { Trigger } from '../lib/alerts/rules';

const TRIGGERS: Trigger[] = [
  { type: 'source-health', line: 'Data source "ticketmaster" has failed 3 consecutive runs — its data is going stale.' },
  { type: 'rate-change', date: '2026-09-26', line: 'Sat, Sep 26: recommended $112 (was $94) — Titans vs <Colts>, likely overflow.' },
];

describe('alertDigestEmail', () => {
  const msg = alertDigestEmail(TRIGGERS, 'https://rr.example.com/');

  it('keeps the subject short and dated by the earliest dated trigger', () => {
    expect(msg.subject).toBe('Rate Radar: 2 updates · Sat, Sep 26');
  });

  it('escapes feed text and never shows the rules joiner dash', () => {
    expect(msg.html).toContain('Titans vs &lt;Colts&gt;');
    expect(msg.html).not.toContain('<Colts>');
    expect(msg.html).not.toContain('—');
    expect(msg.text).not.toContain('—');
  });

  it('orders groups rates first, data health last', () => {
    expect(msg.html.indexOf('Rate changes')).toBeLessThan(msg.html.indexOf('Data health'));
    expect(msg.text).toContain('https://rr.example.com/overview');
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
