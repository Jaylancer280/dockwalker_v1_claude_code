-- Rollback: remove batch vessel lookup RPC
drop function if exists public.get_vessels_public_batch(uuid[]);
