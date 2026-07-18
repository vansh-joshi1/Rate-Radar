import Link from 'next/link';
import { demoPortfolio } from '../../../lib/demo';
import { Chip, SampleBadge, SectionTitle } from '../../../components/ui';

export default function Admin() {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SectionTitle>All properties</SectionTitle>
          <SampleBadge />
        </div>
        <button className="btn btn-primary btn-sm">+ Add property</button>
      </div>

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="th">Property</th>
                <th className="th">Tonight&apos;s rec</th>
                <th className="th">Occupancy</th>
                <th className="th">Parity</th>
                <th className="th">Alerts</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {demoPortfolio.map((p) => (
                <tr key={p.name} className="hover:bg-ink/[0.03]">
                  <td className="td">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-muted">{p.city}</div>
                  </td>
                  <td className="td font-serif text-xl text-accent">${p.rec}</td>
                  <td className="td">{p.occupancy}</td>
                  <td className="td">
                    {p.parity === 'gap' ? <Chip tone="bad">Gap detected</Chip> : <Chip tone="ok">In parity</Chip>}
                  </td>
                  <td className="td">
                    {p.alerts > 0 ? <Chip tone="warn">{p.alerts} new</Chip> : <Chip className="opacity-50">0</Chip>}
                  </td>
                  <td className="td text-right">
                    <Link href="/overview" className="btn btn-sm">Manage</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        Portfolio view — one row per property. Only Red Roof Inn Franklin is live today; the rest illustrate the
        multi-property model.
      </p>
    </div>
  );
}
