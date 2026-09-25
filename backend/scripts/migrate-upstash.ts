/**
 * One-off: copy every live key from the old Upstash Redis into Supabase's kv
 * table, keeping TTLs. Safe to re-run: rows are upserted by key.
 *
 *   KV_REST_API_URL=… KV_REST_API_TOKEN=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     npx tsx backend/scripts/migrate-upstash.ts [--dry-run]
 *
 * Auth.js's own keys (auth:users, auth:email-index, auth:vt:*) are skipped —
 * Supabase Auth owns users now. The Team list (auth:members) is copied.
 * Demo sandboxes (demo:*) are skipped too: they expire within a day anyway.
 */
import { supabaseAdmin } from '../lib/supabase';

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
if (!url || !token) throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN must be set');
const dryRun = process.argv.includes('--dry-run');

async function redis<T>(...parts: (string | number)[]): Promise<T> {
  const res = await fetch(url!, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(parts),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { result: T }).result;
}

const parse = (raw: string): unknown => JSON.parse(raw);
const SKIP = /^(auth:(users|email-index|vt:)|demo:)/;

async function main() {
  const rows: { key: string; value: unknown; expires_at: string | null }[] = [];
  let cursor = '0';
  do {
    const [next, keys] = await redis<[string, string[]]>('SCAN', cursor, 'COUNT', 500);
    cursor = next;
    for (const key of keys) {
      if (SKIP.test(key)) continue;
      const type = await redis<string>('TYPE', key);
      let value: unknown;
      if (type === 'string') value = parse(await redis<string>('GET', key));
      else if (type === 'hash') {
        const flat = await redis<string[]>('HGETALL', key);
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < flat.length; i += 2) obj[flat[i]] = parse(flat[i + 1]);
        value = obj;
      } else if (type === 'list') value = (await redis<string[]>('LRANGE', key, 0, -1)).map(parse);
      else {
        console.warn(`skip ${key}: unsupported type ${type}`);
        continue;
      }
      const pttl = await redis<number>('PTTL', key);
      if (pttl === -2) continue; // expired mid-scan
      rows.push({ key, value, expires_at: pttl > 0 ? new Date(Date.now() + pttl).toISOString() : null });
    }
  } while (cursor !== '0');

  console.log(`${rows.length} keys to copy`);
  for (const r of rows) console.log(`  ${r.key}${r.expires_at ? `  (expires ${r.expires_at})` : ''}`);
  if (dryRun) return;

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabaseAdmin().from('kv').upsert(rows.slice(i, i + 200));
    if (error) throw new Error(`Supabase upsert: ${error.message}`);
  }
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
