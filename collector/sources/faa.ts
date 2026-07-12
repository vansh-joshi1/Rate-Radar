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

    // Grab any program blocks that mention BNA
    const mentionsBna = /BNA/.test(xml);
    let detail: string | undefined;
    if (mentionsBna) {
      const groundStop = /<Ground_Stop_List>[\s\S]*?BNA[\s\S]*?<\/Ground_Stop_List>/.test(xml);
      const delay = /<(Arrival_Departure_Delay_List|Ground_Delay_List)>[\s\S]*?BNA[\s\S]*?<\/\1>/.test(xml);
      if (groundStop) detail = 'Ground stop at BNA';
      else if (delay) detail = 'Delay program active at BNA';
      else detail = 'BNA mentioned in FAA status (closure/other)';
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
