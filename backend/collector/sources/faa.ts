import type { SourceResult } from '../../lib/scoring/types';

/**
 * FAA National Airspace System status — delays / ground stops at one airport
 * (BNA for the original property; the one set at approval for anyone else).
 * Mass disruption at an airport can spike last-minute overnight demand nearby.
 * Flat XML, parsed with regex on the airport block — no XML dependency.
 */
export async function collect(airport = 'BNA'): Promise<SourceResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch('https://nasstatus.faa.gov/api/airport-status-information', {
      headers: { Accept: 'application/xml' },
    });
    if (!res.ok) throw new Error(`FAA HTTP ${res.status}`);
    const xml = await res.text();

    // Real structure (verified live 2026-07-12): airports appear as
    // <ARPT>CODE</ARPT> inside <Delay_type> blocks whose <Name> identifies the
    // program (Ground Stop Programs, Ground Delay Programs, Airport Closures…).
    let detail: string | undefined;
    const tag = `<ARPT>${airport}</ARPT>`;
    if (xml.includes(tag)) {
      const before = xml.slice(0, xml.indexOf(tag));
      const names = [...before.matchAll(/<Name>([^<]+)<\/Name>/g)];
      const program = names.length > 0 ? names[names.length - 1][1] : 'FAA program';
      detail = `${program} affecting ${airport}`;
    }

    return {
      source: 'faa',
      status: 'ok',
      fetchedAt,
      data: { disrupted: Boolean(detail), airport, detail },
    };
  } catch (err) {
    return { source: 'faa', status: 'failed', fetchedAt, error: String(err) };
  }
}
