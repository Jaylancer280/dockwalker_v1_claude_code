-- Rollback 00061: Drop atomic advisor usage function
drop function if exists public.increment_advisor_usage(uuid, text, integer);
