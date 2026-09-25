import type { SourceResult } from '../../lib/scoring/types';

/**
 * FAA National Airspace System status — BNA (Nashville) delays / ground stops.
 * Mass disruption at BNA can spike last-minute overnight demand nearby.
 * Flat XML, parsed with regex on the BNA block — no XML dependency.
 */
export async function collect(): Promise<SourceResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch('https://nasstatus.faa.gov/api/airport-status-information', {
      headers: { Accept: 'application/xml' },
    });
    if (!res.ok) throw new Error(`FAA HTTP ${res.status}`);
    const xml = await res.text();

    // Real structure (verified live 2026-07-12): airports appear as
    // <ARPT>BNA</ARPT> inside <Delay_type> blocks whose <Name> identifies the
    // program (Ground Stop Programs, Ground Delay Programs, Airport Closures…).
    let detail: string | undefined;
    if (xml.includes('<ARPT>BNA</ARPT>')) {
      const before = xml.slice(0, xml.indexOf('<ARPT>BNA</ARPT>'));
      const names = [...before.matchAll(/<Name>([^<]+)<\/Name>/g)];
      const program = names.length > 0 ? names[names.length - 1][1] : 'FAA program';
      detail = `${program} affecting BNA`;
    }

    return {
      source: 'faa',
      status: 'ok',
      fetchedAt,
      data: { bnaDisrupted: Boolean(detail), detail },
    };
  } catch (err) {
    return { source: 'faa', status: 'failed', fetchedAt, error: String(err) };
  }
}
