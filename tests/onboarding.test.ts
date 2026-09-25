import { describe, expect, it } from 'vitest';
import { allCandidates, assignTiers, channelsOf, nearbyHotels, rankCandidates, roomKey, roomsOf } from '../lib/onboarding';

const at = (name: string, token: string, lat: number, lng: number) => ({
  name,
  property_token: token,
  gps_coordinates: { latitude: lat, longitude: lng },
});

const RESULTS = [
  at('Comfort Inn Franklin', 'c', 35.93, -86.87),
  at('Red Roof Inn Nashville - Franklin', 'r', 35.92, -86.86),
  { name: 'No token hotel' },
  at('Holiday Inn Franklin', 'h', 36.1, -86.7),
];

describe('onboarding discovery', () => {
  const ADDRESS = '4202 Franklin Common Court, Franklin, Tennessee 37067';

  it('offers the hotel and not its lookalikes', () => {
    // "Inn" and "Franklin" are shared by every neighbour; only "red roof" tells it apart.
    const c = rankCandidates('Red Roof Inn Franklin', ADDRESS, RESULTS);
    expect(c.map((x) => x.token)).toEqual(['r']);
  });

  it('offers nobody when nothing distinctive matches', () => {
    expect(rankCandidates('Hampton Inn Franklin', ADDRESS, RESULTS)).toEqual([]);
  });

  it('falls back to non-generic words when the name is the town', () => {
    const c = rankCandidates('Franklin Inn', ADDRESS, [at('The Franklin Inn', 'f', 35.9, -86.8), ...RESULTS]);
    expect(c[0].token).toBe('f');
  });

  it('suggests nearby hotels closest first, excluding the property itself', () => {
    const hotels = allCandidates(RESULTS);
    const self = hotels.find((h) => h.token === 'r')!;
    const near = nearbyHotels(self, hotels);
    expect(near.map((n) => n.name)).toEqual(['Comfort Inn Franklin', 'Holiday Inn Franklin']);
  });

  it('lists channels direct first', () => {
    const details = {
      featured_prices: [{ source: 'Expedia.com' }, { source: 'Red Roof', official: true }],
      prices: [{ source: 'Booking.com' }],
    };
    expect(channelsOf(details)[0]).toEqual({ source: 'Red Roof', official: true });
    expect(channelsOf(details)).toHaveLength(3);
  });

  it('merges the names channels give the same room, keeping the cheapest rate', () => {
    expect(roomKey('2 Queen Beds Non-Smoking')).toBe(roomKey('Two Queen Room'));
    expect(roomKey('Standard King')).toBe(roomKey('1 King Bed'));
    expect(roomKey('Deluxe King')).not.toBe(roomKey('King Room'));
    const rate = (n: number) => ({ extracted_lowest: n });
    const rooms = roomsOf({
      featured_prices: [
        { source: 'Expedia.com', rooms: [{ name: '1 King Bed', rate_per_night: rate(92) }, { name: 'Two Queen Beds' }] },
        { source: 'Red Roof', official: true, rooms: [{ name: 'King Room', rate_per_night: rate(89) }, { name: '2 Queen Beds Non-Smoking' }] },
      ],
    });
    expect(rooms).toEqual([
      { name: 'King Room', price: 89 },
      { name: 'Two Queen Beds', price: null },
    ]);
  });

  const tiers = (rooms: { name: string; price: number | null }[]) =>
    Object.fromEntries(assignTiers(rooms).map((r) => [r.name, r.tier]));

  it("splits tiers at the widest gap in this hotel's own rates", () => {
    expect(tiers([
      { name: 'King Room', price: 89 },
      { name: '2 Queen Beds', price: 94 },
      { name: 'Studio', price: 139 },
      { name: 'Two Room Loft', price: 149 },
    ])).toEqual({ 'King Room': 'standard', '2 Queen Beds': 'standard', Studio: 'superior', 'Two Room Loft': 'superior' });
  });

  it('keeps near-identical rates in one tier', () => {
    expect(tiers([{ name: 'King Room', price: 95 }, { name: 'Deluxe Queen', price: 99 }])).toEqual({
      'King Room': 'standard',
      'Deluxe Queen': 'superior', // prices too close to split, so the name decides
    });
  });

  it('reads names relative to the hotel: its lowest level is Standard whatever it is called', () => {
    expect(tiers([{ name: 'Deluxe King', price: null }, { name: 'Executive Suite', price: null }])).toEqual({
      'Deluxe King': 'standard',
      'Executive Suite': 'superior',
    });
    expect(tiers([{ name: 'King Room', price: null }, { name: 'Two Queen', price: null }])).toEqual({
      'King Room': 'standard',
      'Two Queen': 'standard',
    });
  });
});
