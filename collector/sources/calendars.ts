import * as cheerio from 'cheerio';
import type { RawEvent, SourceResult } from '../../lib/scoring/types';

/**
 * Best-effort scrapes of public informational pages. Page structures change
 * year to year: a broken parse logs a clear warning and SKIPS that sub-source,
 * never crashes the run. Only sub-sources that parse contribute events.
 *
 * Verified structures (July 2026):
 * - Vanderbilt: h3 season headings ("Fall 2026") + tables whose date cells omit
 *   the year ("May 14, Fri") — year is carried from the heading.
 * - Belmont: generic keyword+date extraction (structure varies).
 * - Music City Center: JS-rendered calendar — plain fetch may yield nothing, in
 *   which case it warns and skips (see README maintenance notes).
 */

const OVERNIGHT_KEYWORDS =
  /commencement|graduation|move[- ]?in|family weekend|parents weekend|homecoming|reunion/i;
const MCC_MULTIDAY = /convention|expo|conference|summit|championship|show(?:case)?/i;
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

interface SubResult {
  name: string;
  events: RawEvent[];
  warning?: string;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RateRadar internal calendar check)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** "May 14" + year context → YYYY-MM-DD. Handles "Aug 26", "June 8", "Nov 21-Nov 29" (takes first date). */
export function parseMonthDay(text: string, year: number): string | null {
  const m = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})\b/);
  if (!m) return null;
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (!month) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
}

/** Full-date extraction: "May 8, 2026" / "2026-05-08". */
export function parseDate(text: string): string | null {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const us = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (us) {
    const month = MONTHS[us[1].slice(0, 3).toLowerCase()];
    if (month) return `${us[3]}-${String(month).padStart(2, '0')}-${String(Number(us[2])).padStart(2, '0')}`;
  }
  return null;
}

function uniq(events: RawEvent[]): RawEvent[] {
  return [...new Map(events.map((e) => [e.id, e])).values()];
}

/** Vanderbilt registrar academic calendar: h3 "Fall 2026" headings + date|description table rows. */
export function parseVanderbilt(html: string, url: string): SubResult {
  const $ = cheerio.load(html);
  const events: RawEvent[] = [];
  let currentYear: number | null = null;

  $('h1, h2, h3, h4, tr').each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? '';
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (tag !== 'tr') {
      const y = text.match(/\b(20\d{2})\b/);
      if (y) currentYear = Number(y[1]);
      return;
    }
    if (!currentYear || !OVERNIGHT_KEYWORDS.test(text)) return;
    const cells = $(el).find('td, th').toArray().map((c) => $(c).text().replace(/\s+/g, ' ').trim());
    if (cells.length < 2) return;
    const date = parseMonthDay(cells[0], currentYear);
    if (!date) return;
    const name = cells[1].slice(0, 80);
    events.push({
      id: `cal:vanderbilt:${date}:${name.slice(0, 24)}`,
      name: `Vanderbilt: ${name}`,
      date,
      venue: 'Vanderbilt',
      capacity: null,
      expectedAttendance: /commencement|graduation/i.test(name) ? 20000 : 8000,
      kind: 'university',
      source: 'calendars',
    });
  });

  const unique = uniq(events);
  return unique.length > 0
    ? { name: 'Vanderbilt', events: unique }
    : { name: 'Vanderbilt', events: [], warning: `Vanderbilt calendar parsed but produced 0 overnight-relevant events — page structure may have changed: ${url}` };
}

/** Generic fallback: any row/list item with an overnight keyword AND a full date. */
export function parseUniversityCalendar(html: string, school: string, url: string): SubResult {
  const $ = cheerio.load(html);
  const events: RawEvent[] = [];
  $('tr, li, .event, [class*="event"]').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 300 || !OVERNIGHT_KEYWORDS.test(text)) return;
    const date = parseDate(text);
    if (!date) return;
    const name = text.slice(0, 80);
    events.push({
      id: `cal:${school.toLowerCase()}:${date}:${name.slice(0, 24)}`,
      name: `${school}: ${name}`,
      date,
      venue: school,
      capacity: null,
      expectedAttendance: /commencement|graduation/i.test(text) ? 20000 : 8000,
      kind: 'university',
      source: 'calendars',
    });
  });
  const unique = uniq(events);
  return unique.length > 0
    ? { name: school, events: unique }
    : { name: school, events: [], warning: `${school} calendar parsed but produced 0 overnight-relevant events — page structure may have changed: ${url}` };
}

/**
 * Music City Center calendar (nashvillemcc.com/calendar — the site moved off
 * nashvillemusiccitycenter.com in 2026). Server-rendered, plain-fetchable.
 * Verified structure (2026-07-12): entries read
 *   "Event Name Wednesday July 22, 2026 to Friday July 24, 2026 ... Event ID: 8591"
 * and a month-grid section repeats each event with "Attendance: 950".
 * Parses page TEXT rather than DOM classes — resilient to restyling.
 */
export function parseMcc(html: string, url: string): SubResult {
  const $ = cheerio.load(html);
  // Flatten ALL whitespace (incl. newlines between HTML elements) to single
  // spaces — cheerio's text() of the real page separates nodes with newlines,
  // which broke space-delimited matching on the first GitHub Actions run.
  const text = $('body').text().replace(/\s+/g, ' ');

  // Parse the month-grid section: it carries clean names, dates, and published
  // attendance in one place, under month headers that provide year context:
  //   "July 2026 ... Jul 22 - 24 Firehouse Sub 2026 Attendance: 950
  //    ... Jul 29 - Aug 01 National Urban League Annual Conference Attendance: 4000"
  const MONTH_FULL = 'January|February|March|April|May|June|July|August|September|October|November|December';
  const MON = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';

  // month headers ("July 2026") — position → year/month context
  const headers: { index: number; year: number }[] = [];
  for (const m of text.matchAll(new RegExp(`\\b(?:${MONTH_FULL}) (20\\d{2})\\b`, 'g'))) {
    headers.push({ index: m.index!, year: Number(m[1]) });
  }
  const yearAt = (index: number): number | null => {
    let y: number | null = null;
    for (const h of headers) if (h.index < index) y = h.year;
    return y;
  };

  const entry = new RegExp(
    `\\b(${MON}) (\\d{1,2})(?: ?- ?(?:(${MON}) )?(\\d{1,2}))? (.{3,90}?) Attendance: ([\\d,]+)`, 'g'
  );
  const monthNum = (mon: string): number => MONTHS[mon.toLowerCase()]!;
  const iso = (y: number, mo: number, d: number) =>
    `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const events: RawEvent[] = [];
  for (const m of text.matchAll(entry)) {
    const [, startMon, startDay, endMon, endDay, rawName, att] = m;
    const year = yearAt(m.index!);
    if (!year) continue; // no month-header context → not the grid section
    const sMo = monthNum(startMon);
    const start = iso(year, sMo, Number(startDay));
    let end: string | null = null;
    if (endDay) {
      const eMo = endMon ? monthNum(endMon) : sMo;
      const eYear = eMo < sMo ? year + 1 : year; // Dec 30 - Jan 02 rollover
      end = iso(eYear, eMo, Number(endDay));
    }
    const name = rawName.trim();

    // nights: multi-day events occupy start..end-1; single-day events just that night
    const nights: string[] = [];
    if (end && end > start) {
      const d = new Date(`${start}T12:00:00Z`);
      const stop = new Date(`${end}T12:00:00Z`);
      while (d < stop) {
        nights.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
      }
    } else {
      nights.push(start);
    }

    for (const night of nights) {
      events.push({
        id: `mcc:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}:${night}`,
        name: `Music City Center: ${name}`,
        date: night,
        venue: 'Music City Center',
        capacity: null,
        expectedAttendance: Number(att.replace(/,/g, '')) || 5000,
        kind: 'convention',
        source: 'calendars',
      });
    }
  }

  const unique = uniq(events);
  return unique.length > 0
    ? { name: 'Music City Center', events: unique }
    : { name: 'Music City Center', events: [], warning: `MCC calendar parsed but produced 0 events — page structure may have changed: ${url}` };
}

/** July 2026 → "2026-27" (academic years roll over in June). */
export function academicYearSlug(now = new Date()): string {
  const y = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

function sources(now = new Date()) {
  const slug = academicYearSlug(now);
  return [
    {
      url: `https://registrar.vanderbilt.edu/calendars/${slug}-academic.php`,
      parse: (html: string, url: string) => parseVanderbilt(html, url),
    },
    {
      url: 'https://www.belmont.edu/registrar/academic-calendars/',
      parse: (html: string, url: string) => parseUniversityCalendar(html, 'Belmont', url),
    },
    {
      url: 'https://nashvillemcc.com/calendar',
      parse: (html: string, url: string) => parseMcc(html, url),
    },
  ];
}

export async function collect(): Promise<SourceResult> {
  const fetchedAt = new Date().toISOString();
  const events: RawEvent[] = [];
  const warnings: string[] = [];
  const srcs = sources();

  for (const s of srcs) {
    try {
      const result = s.parse(await fetchHtml(s.url), s.url);
      events.push(...result.events);
      if (result.warning) {
        warnings.push(result.warning);
        console.warn(`[calendars] ${result.warning}`);
      }
    } catch (err) {
      const w = `${s.url} fetch/parse failed — skipped: ${String(err)}`;
      warnings.push(w);
      console.warn(`[calendars] ${w}`);
    }
  }

  // Partial success is normal; only 'failed' if EVERY sub-source produced nothing.
  if (events.length === 0 && warnings.length === srcs.length) {
    return { source: 'calendars', status: 'failed', fetchedAt, error: warnings.join(' | ') };
  }
  return {
    source: 'calendars', status: 'ok', fetchedAt, data: events,
    ...(warnings.length > 0 ? { error: warnings.join(' | ') } : {}),
  };
}
