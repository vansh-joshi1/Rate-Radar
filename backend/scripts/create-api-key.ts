/**
 * Mint a v1 API key and store its hash.
 *
 *   npm run apikey -- --name "partner-x"                 # all properties, 60 rpm
 *   npm run apikey -- --name "cli" --properties rri-franklin --rpm 30
 *
 * Runs against Upstash when KV_REST_API_URL/KV_REST_API_TOKEN are set (e.g.
 * `vercel env pull` first), otherwise against the local .data/store.json.
 * The plaintext key is printed ONCE and never stored.
 */
import { getStore } from '../lib/store';
import { APIKEYS_HASH, generateApiKey, hashApiKey, newKeyRecord } from '../lib/api/auth';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const name = arg('--name');
  if (!name) {
    console.error('Usage: npm run apikey -- --name <label> [--properties id1,id2] [--rpm 60]');
    process.exit(1);
  }
  const propertyIds = arg('--properties')?.split(',').map((s) => s.trim()) ?? ['*'];
  const rpm = Number(arg('--rpm') ?? 60);

  const key = generateApiKey();
  const record = newKeyRecord(name, propertyIds, rpm);
  await getStore().hset(APIKEYS_HASH, hashApiKey(key), record);

  console.log(`\nAPI key created for "${name}" (${propertyIds.join(', ')} @ ${rpm} rpm)`);
  console.log('Store target:', process.env.KV_REST_API_URL ? 'Upstash (production)' : 'local file store');
  console.log('\n  ' + key + '\n');
  console.log('Save it now — only its hash is stored, it cannot be shown again.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
