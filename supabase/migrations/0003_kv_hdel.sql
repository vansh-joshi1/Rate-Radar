-- Store.hdel: drop fields from a hash in one statement (ingest prunes old `history` days).
create or replace function public.kv_hdel(k text, f text[]) returns void
language sql as $$
  update public.kv set value = value - f where key = k;
$$;

revoke execute on function public.kv_hdel from public, anon, authenticated;
grant execute on function public.kv_hdel to service_role;
