import { loadSnapshot } from '../../../lib/dashboard-data';
import { SampleBadge } from '../../../components/ui';
import ReasoningCard from '../../../components/ReasoningCard';
import MarketIntelligence, { type MIEvent, type MINight } from '../../../components/MarketIntelligence';
import { DEFAULT_PROPERTY_ID, getProperty } from '../../../lib/properties';
import { milesBetween, venueCoords } from '../../../lib/scoring/venues';
import { chicagoToday } from '../../../lib/ingest';

export const dynamic = 'force-dynamic';


export default async function Calendar() {
  const { snapshot, isDemo } = await loadSnapshot();
  const property = getProperty(DEFAULT_PROPERTY_ID)!;

  // Every scored event in the window, deduped by id — an event spanning
  // several nights appears once, dated to its first night.
  const seen = new Set<string>();
  const events: MIEvent[] = [];
  for (const night of snapshot.nights) {
    for (const e of night.events) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      const coords = venueCoords(e.venue);
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
    const top = [...n.events].sort((a, b) => b.score - a.score)[0];
    return {
      date: n.date,
      nightScore: n.nightScore,
      holidayName: n.holidayName,
      // Only label a cell when the driver actually moved the number.
      topEvent: n.holidayName ?? (top && top.tier !== 'too-small' ? top.name : undefined),
    };
  });

  const tonight = snapshot.nights[0];

  return (
    <div>
      {isDemo && (
        <div className="mb-md flex justify-end">
          <SampleBadge />
        </div>
      )}

      <MarketIntelligence
        property={{ name: property.name, lat: property.lat, lng: property.lng }}
        events={events}
        nights={nights}
        weather={{ note: tonight?.weatherNote, bnaNote: tonight?.bnaNote }}
        today={chicagoToday()}
        timeZone={property.timezone}
      />

      <div className="mt-xl space-y-lg">
        <ReasoningCard
          date={tonight.date}
          reasoning={tonight.reasoning}
          confidence={snapshot.confidence}
          confidenceNote={snapshot.confidenceNote}
        />

        <p className="text-center text-xs text-muted">
          Events judged too small to matter are shown with that verdict — never silently dropped.
        </p>
      </div>
    </div>
  );
}
