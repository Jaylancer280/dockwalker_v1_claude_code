-- Rollback for 00123. Restores apply_projection to its pre-D-2 body
-- (no null-safety guards on DAYWORK.ACCEPTED / DAYWORK.INVITATION_ACCEPTED
-- / DAYWORK.POSITIONS_UPDATED). Operators should re-run
-- 00121_vessel_history_projection.sql to restore that body.
--
-- The guards added in 00123 are defensive only — un-applying them does
-- not corrupt data. Same NOTICE-only rollback pattern as 00121 / 00122.

do $$
begin
  raise notice
    'Rollback for 00123: re-apply migration 00121_vessel_history_projection.sql to restore the pre-D-2 apply_projection body (no null-safety guards on the three daywork handlers).';
end $$;
