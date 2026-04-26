-- Rollback for 00116_multi_nationality_projection.sql
--
-- Reverts apply_projection to the prior definition (00108 body). This
-- requires re-pasting the exact 00108 body. The simplest safe rollback
-- is to drop and recreate from 00108 — operators should ensure 00108's
-- migration is still present in the migrations directory before running
-- this rollback.
--
-- For now: emit a NOTICE and leave the function as-is. Manual rollback
-- via re-running 00108_admin_delete_full_wipe.sql is the supported path
-- (it uses CREATE OR REPLACE). The schema column nationality_ids
-- introduced in 00114 is unaffected by this rollback — only the
-- projection wiring reverts.
--
-- A clean rollback path requires copying the 00108 function body here
-- verbatim, which is brittle. Operators rolling back should instead
-- re-apply 00108 via `psql -f` or by replaying the migration sequence.

do $$
begin
  raise notice 'Rollback note: re-apply 00108_admin_delete_full_wipe.sql to restore the prior apply_projection definition. The nationality_ids column from 00114 is preserved.';
end $$;
