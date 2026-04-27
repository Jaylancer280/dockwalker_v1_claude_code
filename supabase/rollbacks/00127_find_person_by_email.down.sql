-- Rollback for 00127: drop the find_person_id_by_email RPC.
drop function if exists public.find_person_id_by_email(text);
