import { describe, it, expect } from 'vitest';
import { harvestCompset } from '../collector/sources/rates';

describe('harvestCompset (name-anchored, resilient to Google layout noise)', () => {
  it('finds whitelisted comps despite rating/amenity/link lines between name and price', () => {
    // layout observed on the real Google Hotels page from a GitHub runner:
    const text = [
      'Comfort Inn Franklin Highway 96',
      '4.1(414)',
      '2-star hotel',
      'Breakfast ($)',
      'View prices',
      '$53 · ',
      'The Harpeth Franklin Downtown, Curio Collection by Hilton', // luxury — not whitelisted
      '4.6(1,004)',
      '$270 · ',
      'Clarion Pointe Franklin - Nashville Area',
      'DEAL 25% less than usual',
      'Free breakfast',
      'Free Wi-Fi',
      'View prices',
      '$52 · ',
      'Holiday Inn Franklin - Cool Springs by IHG',
      '$57 · ',
    ].join('\n');

    const comps = harvestCompset(text);
    expect(comps).toEqual([
      { name: 'Comfort Inn Franklin Highway 96', price: 53 },
      { name: 'Clarion Pointe Franklin - Nashville Area', price: 52 },
      { name: 'Holiday Inn Franklin - Cool Springs by IHG', price: 57 },
    ]);
  });

  it('does not match a price beyond the card window', () => {
    const lines = ['Comfort Inn Franklin Highway 96'];
    for (let i = 0; i < 15; i++) lines.push(`filler line ${i}`);
    lines.push('$53 ·');
    expect(harvestCompset(lines.join('\n'))).toEqual([]);
  });

  it('matches Booking.com naming style and card depth', () => {
    const text = [
      'Holiday Inn Franklin - Cool Springs, an IHG Hotel', // Booking says "an IHG Hotel", Google says "by IHG"
      '8.4', 'Very Good', '1,203 reviews',
      '2.1 miles from downtown', 'Subway access',
      'King Room', '1 extra-large double bed',
      'Free cancellation', 'No prepayment needed', 'Breakfast included',
      'US$57',
      'Candlewood Suites Nashville - Franklin, an IHG Hotel',
      '8.1', 'Studio Suite', 'US$72',
    ].join('\n');
    expect(harvestCompset(text)).toEqual([
      { name: 'Holiday Inn Franklin - Cool Springs, an IHG Hotel', price: 57 },
      { name: 'Candlewood Suites Nashville - Franklin, an IHG Hotel', price: 72 },
    ]);
  });

  it('never steals the next card\'s price (guard on next whitelisted name)', () => {
    const text = [
      'Comfort Inn Franklin', // its own price is missing entirely
      'sold out', 'no availability',
      'Clarion Pointe Franklin - Nashville Area',
      '$52 ·',
    ].join('\n');
    expect(harvestCompset(text)).toEqual([
      { name: 'Clarion Pointe Franklin - Nashville Area', price: 52 },
    ]);
  });

  it('dedupes repeated listings of the same comp', () => {
    const text = [
      'Comfort Inn Franklin Highway 96', '$53 ·',
      'Comfort Inn Franklin Highway 96', '$55 ·',
    ].join('\n');
    expect(harvestCompset(text)).toEqual([{ name: 'Comfort Inn Franklin Highway 96', price: 53 }]);
  });
});
