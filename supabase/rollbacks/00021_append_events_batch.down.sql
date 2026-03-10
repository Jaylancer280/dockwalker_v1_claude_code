-- Rollback 00021: Drop batch event append function
drop function if exists public.append_events_batch(jsonb);
