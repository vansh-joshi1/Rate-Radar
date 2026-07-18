import { demoAlerts } from '../../../lib/demo';
import { SampleBadge, SectionTitle } from '../../../components/ui';
import { BellIcon, InfoIcon, ShieldIcon, TrendIcon, WarnIcon } from '../../../components/shell/Icons';

const ICONS = { accent: TrendIcon, bad: ShieldIcon, warn: WarnIcon, neutral: InfoIcon } as const;
const COLORS = { accent: 'text-accent', bad: 'text-bad', warn: 'text-warn', neutral: 'text-muted' } as const;

export default function Alerts() {
  const unread = demoAlerts.filter((a) => a.unread).length;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SectionTitle>Alert center</SectionTitle>
          <SampleBadge />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted"><BellIcon size={16} /> {unread} unread</div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
        <div className="card p-0">
          {demoAlerts.map((a) => {
            const Icon = ICONS[a.tone];
            return (
              <div
                key={a.id}
                className={`flex gap-4 border-b border-line p-4 last:border-b-0 hover:bg-ink/[0.02] ${
                  a.unread ? 'border-l-4 border-l-accent bg-accent/[0.03]' : ''
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper ${COLORS[a.tone]}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <div className="mb-0.5 text-xs text-muted">{a.time}</div>
                  <div className="font-bold">{a.title}</div>
                  <div className="text-sm text-muted">{a.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <h3 className="mb-4 text-lg font-bold tracking-tight">Alert settings</h3>
          <div className="mb-6">
            <div className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted">Notifications</div>
            {['Rate recommendations', 'Parity gaps > $5', 'Source errors'].map((l) => (
              <label key={l} className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked className="accent-[var(--accent-red)]" /> {l}
              </label>
            ))}
          </div>
          <div>
            <div className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted">Email recipients</div>
            {['owner@hotel.com', 'manager@hotel.com'].map((e) => (
              <div key={e} className="mb-1 border border-line bg-paper px-2 py-1 text-sm">{e}</div>
            ))}
            <button className="btn btn-sm mt-2 w-full">Add recipient</button>
          </div>
        </div>
      </div>
    </div>
  );
}
