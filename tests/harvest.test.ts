import { describe, it, expect } from 'vitest';
import { harvestCompset } from '../collector/sources/rates';

/**
 * Position-based harvest: whitelisted brand found anywhere in rendered text,
 * price taken from within its card window, window ends at the next brand.
 * Names in results are the whitelist entries themselves (stable display names
 * across Google's and Booking's different phrasings).
 */
describe('harvestCompset (position-based, layout-agnostic)', () => {
  it('matches across Google-style layouts', () => {
    const text = [
      'Comfort Inn Franklin Highway 96',
      '4.1(414)', '2-star hotel', 'Breakfast ($)', 'View prices',
      '$53 · ',
      'The Harpeth Franklin Downtown, Curio Collection by Hilton', // luxury — not whitelisted
      '$270 · ',
      'Clarion Pointe Franklin - Nashville Area',
      'DEAL 25% less than usual', 'Free breakfast',
      '$52 · ',
    ].join('\n');
    expect(harvestCompset(text)).toEqual([
      { name: 'Comfort Inn Franklin', price: 53 },
      { name: 'Clarion Pointe', price: 52 },
    ]);
  });

  it('matches Booking-style phrasing and mashed text without newlines', () => {
    const text =
      'Holiday Inn Franklin - Cool Springs, an IHG Hotel 8.4 Very Good 1,203 reviews King Room Free cancellation US$57 ' +
      'Candlewood Suites Nashville - Franklin, an IHG Hotel 8.1 Studio Suite US$72';
    expect(harvestCompset(text)).toEqual([
      { name: 'Holiday Inn Franklin', price: 57 },
      { name: 'Candlewood Suites', price: 72 },
    ]);
  });

  it('never steals the next card\'s price (window ends at next brand)', () => {
    const text = 'Comfort Inn Franklin sold out no availability Clarion Pointe Franklin $52 ·';
    expect(harvestCompset(text)).toEqual([{ name: 'Clarion Pointe', price: 52 }]);
  });

  it('ignores prices beyond a plausible card window', () => {
    const filler = 'x'.repeat(600);
    expect(harvestCompset(`Comfort Inn Franklin ${filler} $53`)).toEqual([]);
  });

  it('takes each brand once (first occurrence with a price)', () => {
    const text = 'Comfort Inn Franklin $53 · more stuff Comfort Inn Franklin $55 ·';
    expect(harvestCompset(text)).toEqual([{ name: 'Comfort Inn Franklin', price: 53 }]);
  });

  it('rejects junk prices via sanity bounds', () => {
    expect(harvestCompset('Comfort Inn Franklin from $9')).toEqual([]);
    expect(harvestCompset('Comfort Inn Franklin total $999')).toEqual([]);
  });
});
