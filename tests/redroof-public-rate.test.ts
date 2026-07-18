import { describe, expect, it } from 'vitest';
import { parseRedroofPublicPrices, parseRedroofRooms } from '../collector/sources/rates';
import { mapRoomToTier } from '../collector/properties';

/**
 * Fixture: rendered text of the live redroof.com room list (RRI1430,
 * 2026-07-17, abridged). Every room shows a member-gated discount block FIRST
 * (public price struck through + ~10%-off member price), closed by
 * "Sign in or Join to book this Member rate.", then the public Flexible Rate.
 * The old min-over-everything parse reported the member rate ($67.50) as the
 * property's listed rate.
 */
const LIVE_PAGE_TEXT = `
Deluxe 2 Queen Beds Non-Smoking
Sleeps 4 guests
Member
 Flexible Rate
Our most flexible rate with easy options for change if you need it plus other member perks.
75.00
USD/night
67.50
USD/night
Cost with taxes & fees 80.16 USD
Sign in or Join to book this Member rate.
Flexible Rate
Our most flexible rate with easy options for change if you need it.
75.00
USD/night
Cost with taxes & fees 89.06 USD
Superior King Non-Smoking
Sleeps 2 guests
Member
 Flexible Rate
Our most flexible rate with easy options for change if you need it plus other member perks.
80.00
USD/night
72.00
USD/night
Cost with taxes & fees 85.50 USD
Sign in or Join to book this Member rate.
Flexible Rate
Our most flexible rate with easy options for change if you need it.
80.00
USD/night
Cost with taxes & fees 95.00 USD
ADA Accessible Deluxe 1 Queen Bed with Roll-In Shower Non-Smoking
Sleeps 2 guests
Member
 Flexible Rate
75.00
USD/night
67.50
USD/night
Sign in or Join to book this Member rate.
Flexible Rate
75.00
USD/night
Cost with taxes & fees 89.06 USD
`;

describe('redroof public-rate parsing (member rates excluded)', () => {
  it('returns only public flexible rates from the live page text', () => {
    const prices = parseRedroofPublicPrices(LIVE_PAGE_TEXT);
    expect(prices).toEqual([75, 80, 75]);
  });

  it('cheapest public rate is $75 — never the $67.50 member rate', () => {
    const prices = parseRedroofPublicPrices(LIVE_PAGE_TEXT);
    expect(Math.min(...prices)).toBe(75);
    expect(prices).not.toContain(67);
    expect(prices).not.toContain(72);
  });

  it('pages without member blocks still parse all prices', () => {
    const plain = 'Standard Room\n68.00\nUSD/night\nDeluxe Room\n78.00\nUSD/night';
    expect(parseRedroofPublicPrices(plain)).toEqual([68, 78]);
  });

  it('applies the price sanity window', () => {
    expect(parseRedroofPublicPrices('999.00\nUSD/night\n20.00\nUSD/night\n75.00\nUSD/night')).toEqual([75]);
  });
});

describe('room-level parsing + tier mapping', () => {
  it('captures each room with its public and member price', () => {
    const rooms = parseRedroofRooms(LIVE_PAGE_TEXT);
    expect(rooms).toEqual([
      { room: 'Deluxe 2 Queen Beds Non-Smoking', price: 75, memberPrice: 67 },
      { room: 'Superior King Non-Smoking', price: 80, memberPrice: 72 },
      { room: 'ADA Accessible Deluxe 1 Queen Bed with Roll-In Shower Non-Smoking', price: 75, memberPrice: 67 },
    ]);
  });

  it('returns [] on unrecognized structure (callers fall back to the flat scan)', () => {
    expect(parseRedroofRooms('some page with no room cards\n75.00\nUSD/night')).toEqual([]);
  });

  it('maps room names to tiers by first-substring-match with * catch-all', () => {
    const rules = [
      { match: 'superior', tierId: 'superior' },
      { match: '*', tierId: 'standard' },
    ];
    expect(mapRoomToTier('Superior King Non-Smoking', rules)).toBe('superior');
    expect(mapRoomToTier('Deluxe 2 Queen Beds Non-Smoking', rules)).toBe('standard');
    expect(mapRoomToTier('anything', [])).toBeUndefined();
  });
});
