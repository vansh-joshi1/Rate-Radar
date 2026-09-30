import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '../lib/bellhop/context';
import { groundingFrom } from '../lib/bellhop/gemini';
import { demoSnapshot } from '../lib/demo';
import { DEMO_PROPERTY } from '../lib/properties';
import { fmtDowDay } from '../lib/date';

describe('buildSystemPrompt', () => {
  const snapshot = demoSnapshot();
  const tonight = snapshot.nights[0];
  const base = {
    property: DEMO_PROPERTY,
    today: tonight.date,
    snapshot,
    history: [],
    actuals: {},
    bookings: {},
  };

  it("carries tonight's recommendation and the engine's own reasoning", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain(tonight.date);
    expect(prompt).toContain(`"recommended":${tonight.tiers[0].recommended}`);
    for (const line of tonight.reasoning) expect(prompt).toContain(JSON.stringify(line).slice(1, -1));
    expect(prompt).toContain(`${DEMO_PROPERTY.totalRooms} rooms`);
    expect(prompt).toContain(`"day":"${fmtDowDay(tonight.date)}"`);
  });

  it('keeps raw source payloads out of the prompt', () => {
    const withData = {
      ...snapshot,
      sources: [{ source: 'ticketmaster', status: 'ok' as const, fetchedAt: '', data: { secret: 'RAW-PAYLOAD' } }],
    };
    expect(buildSystemPrompt({ ...base, snapshot: withData })).not.toContain('RAW-PAYLOAD');
  });

  it("includes tonight's booking readings", () => {
    const prompt = buildSystemPrompt({
      ...base,
      bookings: { [tonight.date]: [{ rooms: 31, at: '2026-09-25T19:10:00Z' }] },
    });
    expect(prompt).toContain('"rooms":31');
  });

  it('says so plainly when there is no snapshot', () => {
    expect(buildSystemPrompt({ ...base, snapshot: null })).toContain('NO SNAPSHOT');
  });
});

describe('groundingFrom', () => {
  const chip = '<style>.chip{color:red}</style><div class="container"><a class="chip" href="https://www.google.com/search?q=bbq">bbq</a></div>';

  it('lists one source per site and passes the suggestions through untouched', () => {
    const g = groundingFrom({
      groundingChunks: [
        { web: { uri: 'https://vertexaisearch.cloud.google.com/r/1', title: 'tripadvisor.com' } },
        { web: { uri: 'https://vertexaisearch.cloud.google.com/r/2', title: 'tripadvisor.com' } },
        { web: { uri: 'https://vertexaisearch.cloud.google.com/r/3', title: 'yelp.com' } },
        { web: { title: 'no-uri.com' } },
      ],
      searchEntryPoint: { renderedContent: chip },
    });
    expect(g).toEqual({
      sources: [
        { title: 'tripadvisor.com', uri: 'https://vertexaisearch.cloud.google.com/r/1' },
        { title: 'yelp.com', uri: 'https://vertexaisearch.cloud.google.com/r/3' },
      ],
      suggestions: chip,
    });
  });

  it('is null for an answer that was not searched', () => {
    expect(groundingFrom(undefined)).toBeNull();
    expect(groundingFrom({})).toBeNull();
  });
});
