import type { RateCheck } from '../lib/scoring/types';

/*
 * Your own listed rate across every channel Google Hotels knows is selling you.
 * Lives on the Competitors page — the dashboard shows the recommendation, this
 * shows where your price is actually visible to guests.
 *
 * Built around one question: is anyone selling your rooms for less than you
 * are? That is what a parity problem looks like from a guest's side, and it is
 * usually a reseller nobody thought to check — the old four-source scraper
 * could not have seen it. Channels are sorted cheapest-first for that reason,
 * and anything under the direct rate is called out rather than buried.
 */

const VISIBLE = 8;

export default function ParityGrid({ parity }: { parity: RateCheck[] }) {
  if (parity.length === 0) return null;

  const official = parity.find((p) => p.official);
  const others = parity
    .filter((p) => !p.official && p.status === 'ok' && p.price != null)
    .sort((a, b) => a.price! - b.price!);

  const direct = official?.status === 'ok' ? official.price ?? null : null;
  const undercutters = direct != null ? others.filter((p) => p.price! < direct) : [];
  const worst = undercutters[0];
  const gap = direct != null && worst ? direct - worst.price! : 0;

  const shown = others.slice(0, VISIBLE);
  const hidden = others.length - shown.length;

  return (
    <div className="rounded-lg border border-line bg-card p-md">
      <h3 className="mb-md font-headline-md text-headline-md text-ink">
        Your listed rate by channel
        {gap > 0 && (
          <span className="ml-2 rounded-full bg-bad px-2.5 py-0.5 text-xs font-bold text-white">
            ${gap} below direct
          </span>
        )}
      </h3>

      {official && (
        <div className="mb-md rounded-lg border border-line bg-paper/60 p-sm">
          <div className="font-label-md text-[10px] uppercase tracking-widest text-muted">
            Direct (your site) · {official.source}
          </div>
          {official.status === 'ok' ? (
            <div className="mt-1 text-2xl font-semibold tabular-nums text-ink">${official.price}</div>
          ) : (
            <div className="mt-1.5 text-xs font-semibold text-warn">NEEDS MANUAL CHECK</div>
          )}
        </div>
      )}

      <div className="grid gap-sm sm:grid-cols-2 xl:grid-cols-4">
        {shown.map((p, i) => {
          const below = direct != null && p.price! < direct;
          return (
            <div
              // Google occasionally lists the same channel twice, so the name alone is not a key.
              key={`${p.source}-${i}`}
              className={`rounded-lg border p-sm ${below ? 'border-bad/40 bg-bad/5' : 'border-line bg-paper/60'}`}
            >
              <div className="truncate font-label-md text-[10px] uppercase tracking-widest text-muted" title={p.source}>
                {p.source}
              </div>
              <div className={`mt-1 text-xl font-semibold tabular-nums ${below ? 'text-bad' : 'text-ink'}`}>
                ${p.price}
              </div>
            </div>
          );
        })}
      </div>

      {hidden > 0 && (
        <p className="mt-sm text-xs text-muted">
          + {hidden} more {hidden === 1 ? 'channel' : 'channels'} at ${shown[shown.length - 1].price} or above.
        </p>
      )}

      <p className="mt-sm text-xs text-muted">
        {direct == null
          ? // No direct rate means no comparison — saying "nothing is undercutting you"
            // here would be asserting something this data cannot support.
            'Your direct rate was not returned this run, so there is nothing to compare the channels against.'
          : undercutters.length > 0
            ? `${undercutters.length} ${undercutters.length === 1 ? 'channel is' : 'channels are'} selling below your direct rate — cheapest is ${worst.source} at $${worst.price}.`
            : 'Nothing is selling below your direct rate.'}{' '}
        Checked for tomorrow night; cheapest public rate per channel, as Google sees it.
      </p>
    </div>
  );
}
