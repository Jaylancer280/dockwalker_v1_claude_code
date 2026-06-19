-- Rollback: 00005_append_event.sql
-- Drops append_event, apply_projection, and check_no_overlap functions

drop function if exists public.check_no_overlap(uuid, uuid);
drop function if exists public.apply_projection(text, text, text, text, jsonb, uuid);
drop function if exists public.append_event(text, text, text, text, jsonb, uuid);
