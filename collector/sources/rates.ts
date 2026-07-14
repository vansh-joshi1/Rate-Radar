import type { Browser, Page } from 'playwright';
import type { CompsetEntry, RateCheck, SourceResult } from '../../lib/scoring/types';
import { matchCompset } from '../../lib/scoring/compset';

/**
 * Rate parity: our own listed rate on 4 public sources, checked independently.
 * Each source is isolated — a block or structure change marks THAT source
 * "needs-manual-check", never guesses, never averages, never crashes the run.
 * Runs in GitHub Actions (full Linux runner) because Google/OTA pages are
 * JS-rendered — do not move this into a Vercel function.
 *
 * Selector maintenance lives in the constants below.
 */

const TIMEOUT = 30_000;
const PRICE_RE = /\$\s?(\d{2,4})(?:\.\d{2})?/;

// ---- selector constants (the bits that rot — keep them here) ----
const REDROOF_PRICE_SELECTORS = ['[class*="price"]', '[class*="rate"]', '[data-testid*="price"]'];
const EXPEDIA_PRICE_SELECTORS = ['[data-test-id="price-summary"]', '[data-stid*="price"]', '[class*="uitk-type-500"]'];
const BOOKING_PRICE_SELECTORS = ['[data-testid="price-and-discounted-price"]', '.prco-valign-middle-helper', '[class*="prc"]'];
const GOOGLE_HOTELS_QUERY_DEFAULT = 'Red Roof Inn Franklin TN 3915 Carothers Parkway';

function tomorrow(offsetDays = 1): { checkin: string; checkout: string } {
  const t = new Date(Date.now() + offsetDays * 86400_000);
  const n = new Date(t.getTime() + 86400_000);
  const f = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  return { checkin: f(t), checkout: f(n) };
}

function rewriteDates(url: string): string {
  const { checkin, checkout } = tomorrow();
  return url
    .replace(/checkInFormatted=[\d-]+/g, `checkInFormatted=${checkin}`)
    .replace(/checkOutFormatted=[\d-]+/g, `checkOutFormatted=${checkout}`)
    .replace(/chkin=[\d-]+/g, `chkin=${checkin}`)
    .replace(/chkout=[\d-]+/g, `chkout=${checkout}`)
    .replace(/checkin=[\d-]+/g, `checkin=${checkin}`)
    .replace(/checkout=[\d-]+/g, `checkout=${checkout}`);
}

async function newPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
  });
  const page = await ctx.newPage();
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (type === 'image' || type === 'font' || type === 'media') return route.abort();
    return route.continue();
  });
  page.setDefaultTimeout(TIMEOUT);
  return page;
}

async function extractPrice(page: Page, selectors: string[]): Promise<{ price: number; room?: string } | null> {
  for (const sel of selectors) {
    const els = await page.locator(sel).all();
    for (const el of els.slice(0, 12)) {
      const text = (await el.textContent().catch(() => '')) ?? '';
      const m = text.match(PRICE_RE);
      if (m) {
        const price = Number(m[1]);
        if (price >= 40 && price <= 500) return { price };
      }
    }
  }
  // last resort: whole-body scan for a plausible nightly price
  const body = (await page.textContent('body').catch(() => '')) ?? '';
  const m = body.match(PRICE_RE);
  if (m) {
    const price = Number(m[1]);
    if (price >= 40 && price <= 500) return { price };
  }
  return null;
}

type Checker = (browser: Browser) => Promise<RateCheck>;

function makeChecker(
  source: RateCheck['source'],
  run: (page: Page) => Promise<{ price: number; room?: string } | null>
): Checker {
  return async (browser) => {
    const fetchedAt = new Date().toISOString();
    let page: Page | null = null;
    try {
      page = await newPage(browser);
      const result = await run(page);
      if (!result) {
        return { source, status: 'needs-manual-check', fetchedAt, error: 'No price found on page — structure may have changed or source blocked the check.' };
      }
      return { source, status: 'ok', fetchedAt, ...result };
    } catch (err) {
      return { source, status: 'needs-manual-check', fetchedAt, error: String(err).slice(0, 200) };
    } finally {
      await page?.context().close().catch(() => undefined);
    }
  };
}

const checkRedroof = makeChecker('redroof', async (page) => {
  const url = process.env.RATE_URL_REDROOF;
  if (!url) throw new Error('RATE_URL_REDROOF unset');
  // The checkout page loads rates via XHR — capture it if it fires, fall back to DOM.
  let apiPrice: number | null = null;
  page.on('response', async (res) => {
    if (!/rate|room|avail/i.test(res.url()) || apiPrice) return;
    try {
      const text = JSON.stringify(await res.json());
      const m = text.match(/"(?:totalRate|rate|price|amountAfterTax)"\s*:\s*"?(\d{2,4})(?:\.\d+)?"?/i);
      if (m) {
        const p = Number(m[1]);
        if (p >= 40 && p <= 500) apiPrice = p;
      }
    } catch { /* non-JSON response — ignore */ }
  });
  await page.goto(rewriteDates(url), { waitUntil: 'networkidle' }).catch(() => undefined);
  if (apiPrice) return { price: apiPrice, room: 'cheapest available (from rates API)' };
  // redroof renders prices WITHOUT a $ sign: "68.00\nUSD/night" (verified live 2026-07-12)
  const body = (await page.textContent('body').catch(() => '')) ?? '';
  const usd = [...body.matchAll(/(\d{2,3})\.\d{2}\s*\n?\s*USD\/night/g)]
    .map((m) => Number(m[1]))
    .filter((p) => p >= 40 && p <= 500);
  if (usd.length > 0) return { price: Math.min(...usd), room: 'cheapest available (flexible rate)' };
  return extractPrice(page, REDROOF_PRICE_SELECTORS);
});

/** Filled by checkGoogle as a side harvest — the same page carries competitor prices. */
let compsetHarvest: CompsetEntry[] = [];

/**
 * Google's "similar hotels" carousel renders as a hotel-name line followed
 * within a few lines by a "$NN ·" price line (verified live 2026-07-12).
 */
/**
 * Name-anchored harvest: we KNOW which competitors we want (the whitelist), so
 * find each name in the page text and scan forward a few lines for its price.
 * The earlier price-anchored approach broke on the real page: Google stacks
 * rating/amenity/"View prices" lines between name and price, so the
 * looked-back "name" was junk that failed the whitelist (observed live —
 * production run harvested 0 comps).
 */
export function harvestCompset(bodyText: string): CompsetEntry[] {
  const lines = bodyText.split('\n').map((l) => l.trim());
  const seen = new Set<string>();
  const candidates: CompsetEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const name = lines[i];
    if (name.length < 6 || name.length > 90) continue;
    // is this line a whitelisted competitor name? (matchCompset does the real
    // filtering; this pre-check just uses it with a dummy price)
    if (matchCompset([{ name, price: 100 }]).length === 0) continue;
    if (seen.has(name.toLowerCase())) continue;
    for (let ahead = 1; ahead <= 8; ahead++) {
      const m = lines[i + ahead]?.match(/\$(\d{2,3})(?:\s*·|\s|$)/);
      if (m) {
        seen.add(name.toLowerCase());
        candidates.push({ name, price: Number(m[1]) });
        break;
      }
    }
  }
  return matchCompset(candidates);
}

const checkGoogle = makeChecker('google', async (page) => {
  const { checkin, checkout } = tomorrow();
  const q = process.env.GOOGLE_HOTELS_QUERY ?? GOOGLE_HOTELS_QUERY_DEFAULT;
  await page.goto(
    `https://www.google.com/travel/search?q=${encodeURIComponent(q)}&checkin=${checkin}&checkout=${checkout}`,
    { waitUntil: 'domcontentloaded' }
  );
  // consent dialog (region-dependent)
  await page.locator('button:has-text("Accept all"), button:has-text("I agree")').first().click({ timeout: 4000 }).catch(() => undefined);
  await page.waitForTimeout(3500); // let prices hydrate
  const body = (await page.textContent('body').catch(() => '')) ?? '';
  compsetHarvest = harvestCompset(body);
  return extractPrice(page, ['[data-hveid] span', 'span']);
});

const checkExpedia = makeChecker('expedia', async (page) => {
  const url = process.env.RATE_URL_EXPEDIA;
  if (!url) throw new Error('RATE_URL_EXPEDIA unset');
  await page.goto(rewriteDates(url), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  return extractPrice(page, EXPEDIA_PRICE_SELECTORS);
});

const checkBooking = makeChecker('booking', async (page) => {
  const url = process.env.RATE_URL_BOOKING;
  if (!url) throw new Error('RATE_URL_BOOKING unset');
  await page.goto(rewriteDates(url), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  return extractPrice(page, BOOKING_PRICE_SELECTORS);
});

export async function collect(): Promise<SourceResult> {
  const fetchedAt = new Date().toISOString();
  let browser: Browser | null = null;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    compsetHarvest = [];
    const checks = await Promise.all(
      [checkRedroof, checkGoogle, checkExpedia, checkBooking].map((c) => c(browser!))
    );
    return {
      source: 'rates',
      status: 'ok',
      fetchedAt,
      data: { checks, compset: compsetHarvest, compsetDate: tomorrow().checkin },
    };
  } catch (err) {
    return { source: 'rates', status: 'failed', fetchedAt, error: String(err).slice(0, 300) };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
