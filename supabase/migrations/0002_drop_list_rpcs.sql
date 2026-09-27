-- The Store no longer has list ops (lpush/lrange had no callers).
drop function if exists public.kv_lpush(text, jsonb);
drop function if exists public.kv_lrange(text, int, int);
