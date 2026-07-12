import type { RawEvent, SourceResult } from '../../lib/scoring/types';

/** collegefootballdata.com — Vanderbilt home games (clean API, no scraping). */
export async function collect(): Promise<SourceResult> {
  const fetchedAt = new Date().toISOString();
  const key = process.env.CFBD_API_KEY;
  if (!key) return { source: 'cfbd', status: 'awaiting-key', fetchedAt };

  try {
    const year = new Date().getFullYear();
    const res = await fetch(
      `https://api.collegefootballdata.com/games?year=${year}&seasonType=regular&team=Vanderbilt`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) throw new Error(`CFBD HTTP ${res.status}`);
    const games = (await res.json()) as {
      id: number; startDate: string; homeTeam: string; awayTeam: string;
    }[];

    const events: RawEvent[] = games
      .filter((g) => g.homeTeam === 'Vanderbilt' && g.startDate)
      .map((g) => ({
        id: `cfbd:${g.id}`,
        name: `Vanderbilt vs ${g.awayTeam} (football)`,
        date: new Date(g.startDate).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }),
        venue: 'FirstBank Stadium',
        capacity: 34000,
        kind: 'sports',
        source: 'cfbd',
      }));

    return { source: 'cfbd', status: 'ok', fetchedAt, data: events };
  } catch (err) {
    return { source: 'cfbd', status: 'failed', fetchedAt, error: String(err) };
  }
}
