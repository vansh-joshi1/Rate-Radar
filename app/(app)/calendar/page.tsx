import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { loadSnapshot } from '../../../lib/dashboard-data';
import ReasoningCard from '../../../components/ReasoningCard';
import MarketIntelligence, { type MIEvent, type MINight } from '../../../components/MarketIntelligence';
import { requestProperty } from '../../../lib/demo/context';
import { milesBetween, venueCoords } from '../../../lib/scoring/venues';
import { demoVenueCoords } from '../../../lib/demo';
import { todayIn } from '../../../lib/date';

export const dynamic = 'force-dynamic';


export default async function Calendar() {
  const { snapshot, isDemo } = await loadSnapshot();
  const property = requestProperty();
  // The demo's venues are invented, so they are placed from the demo's own table.
  const locate = isDemo ? demoVenueCoords : venueCoords;

  // Every scored event in the window, deduped by id — an event spanning
  // several nights appears once, dated to its first night.
  const seen = new Set<string>();
  const events: MIEvent[] = [];
  for (const night of snapshot.nights) {
    for (const e of night.events) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const coords = locate(e.venue);
      events.push({
        id: e.id,
        name: e.name,
        venue: e.venue,
        date: e.date,
        kind: e.kind,
        attendance: e.attendanceEstimate,
        score: e.score,
        tier: e.tier,
        verdict: e.verdict,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        miles: coords ? milesBetween(property, coords) : null,
      });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || b.score - a.score);

  const nights: MINight[] = snapshot.nights.map((n) => {
    const byScore = [...n.events].sort((a, b) => b.score - a.score);
    const top = byScore[0];
    const standard = n.tiers.find((t) => t.tierId === 'standard') ?? n.tiers[0];
    return {
      date: n.date,
      nightScore: n.nightScore,
      holidayName: n.holidayName,
      // Only label a cell when the driver actually moved the number.
      topEvent: n.holidayName ?? (top && top.tier !== 'too-small' ? top.name : undefined),
      rate: standard?.recommended,
      baseline: standard?.baselineMid,
      // Every event on this night, not just the ones first seen on it: the
      // calendar's night detail answers "what is happening that night".
      events: byScore.map((e) => {
        const coords = locate(e.venue);
        return {
          id: e.id,
          name: e.name,
          venue: e.venue,
          kind: e.kind,
          attendance: e.attendanceEstimate,
          score: e.score,
          tier: e.tier,
          verdict: e.verdict,
          miles: coords ? milesBetween(property, coords) : null,
        };
      }),
    };
  });

  const tonight = snapshot.nights[0];

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} space-y-6 font-geist text-[#1a1b20] antialiased`}>
      <MarketIntelligence
        property={{ name: property.name, lat: property.lat, lng: property.lng }}
        events={events}
        nights={nights}
        weather={{ note: tonight?.weatherNote, bnaNote: tonight?.bnaNote }}
        isDemo={isDemo}
        today={todayIn(property.timezone)}
        timeZone={property.timezone}
      />

      {tonight && (
        <ReasoningCard
          date={tonight.date}
          reasoning={tonight.reasoning}
          confidence={snapshot.confidence}
          confidenceNote={snapshot.confidenceNote}
        />
      )}
    </div>
  );
}
