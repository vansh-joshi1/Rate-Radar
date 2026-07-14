import type { Browser, Page } from 'playwright';
import type { CompsetEntry, RateCheck, SourceResult } from '../../lib/scoring/types';
import { matchCompset } from '../../lib/scoring/compset';
import compsetConfig from '../../config/compset.json';

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
const CARD_WINDOW = 500; // chars of rendered text one result card plausibly spans
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
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const page = await ctx.newPage();
  // Headless Chromium advertises itself via navigator.webdriver — the single
  // cheapest tell for bot walls. Removing it fixes a good share of blocks.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (type === 'image' || type === 'font' || type === 'media') return route.abort();
    return route.continue();
  });
  page.setDefaultTimeout(TIMEOUT);
  return page;
}

/** Recognize bot-check interstitials so the dashboard says "blocked", not "structure changed". */
function botWalled(body: string): boolean {
  return /verify you are a human|are you a robot|unusual traffic|press & hold|access denied|captcha|pardon our interruption/i.test(body);
}

/** Nudge lazy-rendered prices into the DOM. */
async function settlePage(page: Page, waitFor: RegExp, timeoutMs = 18_000): Promise<string> {
  await page.evaluate(() => window.scrollBy(0, 900)).catch(() => undefined);
  await page
    .waitForFunction(
      (src) => new RegExp(src, 'i').test(document.body.innerText),
      waitFor.source,
      { timeout: timeoutMs }
    )
    .catch(() => undefined); // fall through — extractor gets whatever rendered
  // Prefer rendered text (no script payloads); fall back to raw textContent
  // when nothing painted — some sites serve a JS shell whose embedded JSON
  // still carries display-formatted prices we can scan.
  let body = (await page.evaluate(() => document.body.innerText).catch(() => '')) ?? '';
  if (body.length < 200) body = (await page.textContent('body').catch(() => '')) ?? '';
  if (botWalled(body)) throw new Error('Blocked by a bot check on this run — usually transient from datacenter IPs; will retry next collection.');
  return body;
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

const ATTEMPTS = 2;

function makeChecker(
  source: RateCheck['source'],
  run: (page: Page) => Promise<{ price: number; room?: string } | null>
): Checker {
  return async (browser) => {
    const fetchedAt = new Date().toISOString();
    let lastError = 'No price found on page — structure may have changed or source blocked the check.';
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      let page: Page | null = null;
      try {
        page = await newPage(browser); // fresh context per attempt — blocks are often per-session
        const result = await run(page);
        if (result) return { source, status: 'ok', fetchedAt, ...result };
      } catch (err) {
        lastError = String(err).slice(0, 200);
      } finally {
        await page?.context().close().catch(() => undefined);
      }
      if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 2500));
    }
    return {
      source,
      status: 'needs-manual-check',
      fetchedAt,
      error: `${lastError} (${ATTEMPTS} attempts)`,
    };
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
  await page.goto(rewriteDates(url), { waitUntil: 'domcontentloaded' }).catch(() => undefined);
  const body = await settlePage(page, /USD\/night/);
  if (apiPrice) return { price: apiPrice, room: 'cheapest available (from rates API)' };
  // redroof renders prices WITHOUT a $ sign: "68.00\nUSD/night" (verified live 2026-07-12)
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
  const lower = bodyText.toLowerCase();
  const brands: string[] = (compsetConfig.competitors as string[]) ?? [];

  // all whitelist occurrences, sorted — each card window ends where the next brand begins
  const marks: { pos: number; brand: string }[] = [];
  for (const brand of brands) {
    const needle = brand.toLowerCase();
    let pos = lower.indexOf(needle);
    let hits = 0;
    while (pos !== -1 && hits < 5) {
      marks.push({ pos, brand });
      hits += 1;
      pos = lower.indexOf(needle, pos + needle.length);
    }
  }
  marks.sort((a, b) => a.pos - b.pos);

  const found = new Map<string, number>();
  for (let i = 0; i < marks.length; i++) {
    const { pos, brand } = marks[i];
    if (found.has(brand)) continue;
    const nextPos = marks.slice(i + 1).find((m) => m.brand !== brand)?.pos ?? pos + CARD_WINDOW;
    const window = bodyText.slice(pos, Math.min(pos + CARD_WINDOW, nextPos));
    const m = window.match(/\$\s?(\d{2,3})(?!\d)/);
    if (m) found.set(brand, Number(m[1]));
  }

  return matchCompset([...found.entries()].map(([name, price]) => ({ name, price })));
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
  const body = await settlePage(page, /\$\d{2,3}/);
  compsetHarvest = harvestCompset(body);
  return extractPrice(page, ['[data-hveid] span', 'span']);
});

const checkExpedia = makeChecker('expedia', async (page) => {
  const url = process.env.RATE_URL_EXPEDIA;
  if (!url) throw new Error('RATE_URL_EXPEDIA unset');
  await page.goto(rewriteDates(url), { waitUntil: 'domcontentloaded' });
  await settlePage(page, /\$\d{2,3} nightly/); // room cards render "$68 nightly" (verified live)
  return extractPrice(page, EXPEDIA_PRICE_SELECTORS);
});

const checkBooking = makeChecker('booking', async (page) => {
  const url = process.env.RATE_URL_BOOKING;
  if (!url) throw new Error('RATE_URL_BOOKING unset');
  await page.goto(rewriteDates(url), { waitUntil: 'domcontentloaded' });
  await settlePage(page, /\$\d{2,3}/);
  return extractPrice(page, BOOKING_PRICE_SELECTORS);
});

/**
 * Competitor prices for one night. Primary: the Google Hotels page for OUR
 * property with that night's dates — its "similar hotels" carousel carries
 * date-consistent competitor prices, and Google demonstrably renders on
 * GitHub runners. Fallback: Booking's Franklin search (serves a JS shell to
 * runners, but its embedded JSON often carries display-formatted prices the
 * position-based scan can still catch).
 */
async function compsetForDate(browser: Browser, checkin: string, rejectSig?: string): Promise<CompsetEntry[]> {
  const d = new Date(`${checkin}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const checkout = d.toISOString().slice(0, 10);
  const q = process.env.GOOGLE_HOTELS_QUERY ?? GOOGLE_HOTELS_QUERY_DEFAULT;

  const attempts: { label: string; url: string }[] = [
    {
      label: 'google',
      url: `https://www.google.com/travel/search?q=${encodeURIComponent(q)}&checkin=${checkin}&checkout=${checkout}`,
    },
    {
      label: 'booking',
      url: `https://www.booking.com/searchresults.html?ss=Franklin%2C+Tennessee&checkin=${checkin}&checkout=${checkout}&group_adults=2&no_rooms=1&selected_currency=USD`,
    },
  ];

  for (const a of attempts) {
    let page: Page | null = null;
    try {
      page = await newPage(browser);
      await page.goto(a.url, { waitUntil: 'domcontentloaded' });
      if (a.label === 'google') {
        await page.locator('button:has-text("Accept all"), button:has-text("I agree")').first().click({ timeout: 4000 }).catch(() => undefined);
      }
      const body = await settlePage(page, /\$\d{2,3}/);
      const entries = harvestCompset(body);
      const sig = entries.map((x) => `${x.name}@${x.price}`).sort().join('|');
      const dateIgnored = rejectSig !== undefined && entries.length > 0 && sig === rejectSig;
      console.log(`[compset] ${checkin} via ${a.label}: page ${body.length} chars → ${entries.length} comps${dateIgnored ? ' (identical to tomorrow — date ignored, trying next source)' : ''}`);
      if (entries.length > 0 && !dateIgnored) return entries;
    } catch (err) {
      console.warn(`[compset] ${a.label} failed for ${checkin}: ${String(err).slice(0, 140)}`);
    } finally {
      await page?.context().close().catch(() => undefined);
    }
  }
  return [];
}

export async function collect(eventNights: string[] = []): Promise<SourceResult> {
  const fetchedAt = new Date().toISOString();
  let browser: Browser | null = null;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
    compsetHarvest = [];
    const checks = await Promise.all(
      [checkRedroof, checkGoogle, checkExpedia, checkBooking].map((c) => c(browser!))
    );

    // Compset: tomorrow always, plus approved event nights (already capped upstream).
    const tomorrowDate = tomorrow().checkin;
    const dates = [tomorrowDate, ...eventNights.filter((dte) => dte !== tomorrowDate)];
    const compsets: { date: string; entries: CompsetEntry[] }[] = [];
    const sig = (e: CompsetEntry[]) => e.map((x) => `${x.name}@${x.price}`).sort().join('|');
    for (const date of dates) {
      const tomorrowSig = date !== tomorrowDate ? sig(compsets.find((c) => c.date === tomorrowDate)?.entries ?? []) : undefined;
      let entries = await compsetForDate(browser, date, tomorrowSig || undefined);
      // Google's carousel harvest (same-run side product) backfills tomorrow if Booking gave nothing
      if (entries.length === 0 && date === tomorrowDate && compsetHarvest.length > 0) {
        entries = compsetHarvest;
      }
      // Honesty guard: identical prices to tomorrow's block means the source
      // ignored our dates (observed live: Google serving default-date carousel
      // for every checkin param). Show nothing rather than mislabeled data.
      const tomorrowBlock = compsets.find((c) => c.date === tomorrowDate);
      if (date !== tomorrowDate && tomorrowBlock && entries.length > 0 && sig(entries) === sig(tomorrowBlock.entries)) {
        console.warn(`[compset] ${date}: prices identical to tomorrow's — source ignored the date; dropping block`);
        entries = [];
      }
      compsets.push({ date, entries });
    }

    return {
      source: 'rates',
      status: 'ok',
      fetchedAt,
      data: { checks, compsets },
    };
  } catch (err) {
    return { source: 'rates', status: 'failed', fetchedAt, error: String(err).slice(0, 300) };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
