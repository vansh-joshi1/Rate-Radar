-- Rate Radar's whole data layer: the Redis-shaped Store interface
-- (backend/lib/store.ts) over one Postgres table. A key holds a JSON value, a
-- JSON object (hash) or a JSON array (list); expires_at gives it a TTL.
--
-- Reads filter out expired rows; the pg_cron job at the bottom sweeps them.

create table if not exists public.kv (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz
);
create index if not exists kv_expires_at on public.kv (expires_at) where expires_at is not null;

-- RLS on with no policies: only the service role (server-side) can reach it.
alter table public.kv enable row level security;

-- HSET: merge one field into a hash. An expired hash starts over, with no TTL.
create or replace function public.kv_hset(k text, f text, v jsonb) returns void
language sql as $$
  insert into public.kv as t (key, value) values (k, jsonb_build_object(f, v))
  on conflict (key) do update set
    value = case when t.expires_at <= now() then jsonb_build_object(f, v)
                 else t.value || jsonb_build_object(f, v) end,
    expires_at = case when t.expires_at <= now() then null else t.expires_at end;
$$;

create or replace function public.kv_hget(k text, f text) returns jsonb
language sql stable as $$
  select value -> f from public.kv
  where key = k and (expires_at is null or expires_at > now());
$$;

-- LPUSH: prepend one element.
create or replace function public.kv_lpush(k text, v jsonb) returns void
language sql as $$
  insert into public.kv as t (key, value) values (k, jsonb_build_array(v))
  on conflict (key) do update set
    value = case when t.expires_at <= now() then jsonb_build_array(v)
                 else jsonb_build_array(v) || t.value end,
    expires_at = case when t.expires_at <= now() then null else t.expires_at end;
$$;

-- LRANGE with Redis semantics: inclusive stop, negative indices count from the end.
create or replace function public.kv_lrange(k text, start int, stop int) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
  from public.kv, jsonb_array_elements(kv.value) with ordinality as el(e, i)
  where kv.key = k and (kv.expires_at is null or kv.expires_at > now())
    and i - 1 >= case when start < 0 then jsonb_array_length(kv.value) + start else start end
    and i - 1 <= case when stop < 0 then jsonb_array_length(kv.value) + stop else stop end;
$$;

-- INCR, with the TTL set only when the counter is born (rate-limit windows).
create or replace function public.kv_incr(k text, ttl int) returns bigint
language sql as $$
  insert into public.kv as t (key, value, expires_at)
  values (k, '1'::jsonb, now() + make_interval(secs => ttl))
  on conflict (key) do update set
    value = case when t.expires_at <= now() then '1'::jsonb
                 else to_jsonb((t.value #>> '{}')::bigint + 1) end,
    expires_at = case when t.expires_at <= now() then excluded.expires_at else t.expires_at end
  returning (value #>> '{}')::bigint;
$$;

-- New projects grant EXECUTE to anon/authenticated by default; these are server-only.
revoke execute on function public.kv_hset, public.kv_hget, public.kv_lpush, public.kv_lrange, public.kv_incr
  from public, anon, authenticated;

-- Newer projects don't auto-grant the Data API roles either, so the service role gets explicit access.
grant select, insert, update, delete on public.kv to service_role;
grant execute on function public.kv_hset, public.kv_hget, public.kv_lpush, public.kv_lrange, public.kv_incr
  to service_role;

-- Hourly sweep of expired keys (demo sandboxes, rate-limit counters).
create extension if not exists pg_cron;
select cron.schedule('kv-sweep', '17 * * * *', $$delete from public.kv where expires_at <= now()$$);
