import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseVanderbilt, parseUniversityCalendar, parseMcc, academicYearSlug, parseMonthDay,
} from '../collector/sources/calendars';

const fx = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

describe('Vanderbilt parser (verified structure, July 2026)', () => {
  it('extracts commencement with year carried from the season heading', () => {
    const r = parseVanderbilt(fx('vandy.html'), 'test://vandy');
    expect(r.warning).toBeUndefined();
    const commencement = r.events.find((e) => /commencement/i.test(e.name));
    expect(commencement).toBeDefined();
    expect(commencement!.date).toBe('2027-05-14');
    expect(commencement!.kind).toBe('university');
    expect(commencement!.expectedAttendance).toBe(20000);
  });
  it('ignores non-overnight rows (first day of classes, breaks)', () => {
    const r = parseVanderbilt(fx('vandy.html'), 'test://vandy');
    expect(r.events.some((e) => /first day of classes/i.test(e.name))).toBe(false);
  });
  it('warns instead of throwing on changed structure', () => {
    const r = parseVanderbilt('<html><body>changed</body></html>', 'test://vandy');
    expect(r.events).toEqual([]);
    expect(r.warning).toContain('structure may have changed');
  });
});

describe('generic university parser (Belmont)', () => {
  it('extracts move-in and commencement with full dates', () => {
    const r = parseUniversityCalendar(fx('belmont.html'), 'Belmont', 'test://belmont');
    expect(r.events.map((e) => e.date).sort()).toEqual(['2026-08-20', '2026-12-12']);
  });
  it('warns on changed structure', () => {
    const r = parseUniversityCalendar('<html><body>x</body></html>', 'Belmont', 'test://belmont');
    expect(r.warning).toBeDefined();
  });
});

describe('MCC parser (verified structure, nashvillemcc.com 2026-07-12)', () => {
  it('parses events with published attendance', () => {
    const r = parseMcc(fx('mcc.html'), 'test://mcc');
    const firehouse = r.events.filter((e) => /firehouse/i.test(e.name));
    expect(firehouse.map((e) => e.date)).toEqual(['2026-07-22', '2026-07-23']); // multi-day: start..end-1 nights
    expect(firehouse[0].expectedAttendance).toBe(950);
  });
  it('single-day event occupies one night', () => {
    const r = parseMcc(fx('mcc.html'), 'test://mcc');
    const engage = r.events.filter((e) => /engage/i.test(e.name));
    expect(engage.map((e) => e.date)).toEqual(['2026-07-26']);
    expect(engage[0].expectedAttendance).toBe(500);
  });
  it('spans month boundaries and finds big events', () => {
    const r = parseMcc(fx('mcc.html'), 'test://mcc');
    const nul = r.events.filter((e) => /urban league/i.test(e.name));
    expect(nul.map((e) => e.date)).toEqual(['2026-07-29', '2026-07-30', '2026-07-31']);
    const hyrox = r.events.filter((e) => /hyrox/i.test(e.name));
    expect(hyrox[0]?.expectedAttendance).toBe(30000);
  });
  it('warns instead of throwing on changed structure', () => {
    const r = parseMcc('<html><body>changed</body></html>', 'test://mcc');
    expect(r.events).toEqual([]);
    expect(r.warning).toContain('structure may have changed');
  });
});

describe('helpers', () => {
  it('academicYearSlug rolls over in June', () => {
    expect(academicYearSlug(new Date('2026-07-12'))).toBe('2026-27');
    expect(academicYearSlug(new Date('2026-03-01'))).toBe('2025-26');
  });
  it('parseMonthDay handles ranges by taking the first date', () => {
    expect(parseMonthDay('Nov 21-Nov 29, Sat-Sun', 2026)).toBe('2026-11-21');
  });
});
