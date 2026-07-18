import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore } from '../lib/store';
import { DEFAULT_RATES_CONFIG, loadRatesConfig, saveRatesConfig, validateRatesConfig, type RatesConfig } from '../lib/rates-config';
import { recommendNight, upliftPct } from '../lib/scoring/recommend';

function freshStore(): FileStore {
  return new FileStore(join(mkdtempSync(join(tmpdir(), 'rr-rc-')), 'store.json'));
}

const CUSTOM: RatesConfig = {
  tiers: [
    {
      id: 'standard',
      label: 'Standard',
      weekday: { min: 60, max: 70 },
      sunday: { min: 65, max: 75 },
      weekend: { min: 70, max: 80 }, // mid 75
    },
  ],
  upliftCapPct: 20,
};

describe('rates config store layer', () => {
  it('first read seeds from config/rates.json and persists edits', async () => {
    const store = freshStore();
    const cfg = await loadRatesConfig(store, 'rri-franklin');
    expect(cfg).toEqual(DEFAULT_RATES_CONFIG);
    await saveRatesConfig(store, 'rri-franklin', CUSTOM);
    expect(await loadRatesConfig(store, 'rri-franklin')).toEqual(CUSTOM);
  });

  it('configs are scoped per property', async () => {
    const store = freshStore();
    await saveRatesConfig(store, 'hotel-a', CUSTOM);
    expect((await loadRatesConfig(store, 'hotel-b')).tiers[0].id).toBe(DEFAULT_RATES_CONFIG.tiers[0].id);
    expect((await loadRatesConfig(store, 'hotel-a')).upliftCapPct).toBe(20);
  });
});

describe('rates config validation', () => {
  it('accepts the shipped default', () => {
    expect(validateRatesConfig(DEFAULT_RATES_CONFIG)).toBeNull();
  });

  it('rejects min above max, out-of-range prices, bad cap, empty tiers', () => {
    const bad = (mutate: (c: RatesConfig) => void): string | null => {
      const c = JSON.parse(JSON.stringify(CUSTOM)) as RatesConfig;
      mutate(c);
      return validateRatesConfig(c);
    };
    expect(bad((c) => { c.tiers[0].weekend = { min: 90, max: 80 }; })).toMatch(/min .* above max/);
    expect(bad((c) => { c.tiers[0].weekday = { min: 5, max: 70 }; })).toMatch(/between \$20 and \$1000/);
    expect(bad((c) => { c.upliftCapPct = 500; })).toMatch(/Uplift cap/);
    expect(bad((c) => { c.tiers = []; })).toMatch(/At least one tier/);
    expect(bad((c) => { c.tiers[0].label = ' '; })).toMatch(/id and a label/);
  });
});

describe('recommendations honor a custom config', () => {
  it('quiet Saturday uses the custom weekend midpoint', () => {
    const [std] = recommendNight('2026-07-18', 0, CUSTOM); // Saturday
    expect(std.recommended).toBe(75);
    expect(std.range).toEqual([70, 80]);
  });

  it('uplift cap comes from the custom config', () => {
    expect(upliftPct(100, CUSTOM)).toBe(20);
    expect(upliftPct(100)).toBe(DEFAULT_RATES_CONFIG.upliftCapPct);
  });
});
