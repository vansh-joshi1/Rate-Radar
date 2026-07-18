import propertiesConfig from '../config/properties.json';
import defaultCompset from '../config/compset.json';
import type { CompsetConfig } from '../lib/scoring/compset';

/**
 * Collection config per property — resolved from config/properties.json.
 * "env:VAR" strings are looked up in the environment at load time so listing
 * URLs can live in GitHub secrets exactly as they always have.
 */

export interface RatePropertyConfig {
  id: string;
  name: string;
  rateUrls: Partial<Record<'redroof' | 'expedia' | 'booking', string>>;
  googleHotelsQuery?: string;
  /** City string for the Booking.com search-results compset fallback. */
  bookingSearchLocation: string;
  compset: CompsetConfig;
}

function resolve(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.startsWith('env:') ? process.env[value.slice(4)] : value;
}

interface RawProperty {
  id: string;
  name: string;
  rateUrls: Record<string, string>;
  googleHotelsQuery?: string;
  bookingSearchLocation: string;
  compset: CompsetConfig | null;
}

export function loadProperties(): RatePropertyConfig[] {
  const raw = (propertiesConfig as { properties: RawProperty[] }).properties;
  return raw.map((p) => {
    const rateUrls: RatePropertyConfig['rateUrls'] = {};
    for (const [source, ref] of Object.entries(p.rateUrls)) {
      const url = resolve(ref);
      if (url) rateUrls[source as keyof RatePropertyConfig['rateUrls']] = url;
    }
    return {
      id: p.id,
      name: p.name,
      rateUrls,
      googleHotelsQuery: resolve(p.googleHotelsQuery),
      bookingSearchLocation: p.bookingSearchLocation,
      compset: p.compset ?? (defaultCompset as CompsetConfig),
    };
  });
}
