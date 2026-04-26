-- Rollback for 00121_vessel_history_projection.sql
--
-- Restoring the prior `apply_projection` body in full would be ~490
-- lines of duplicated SQL. Per the established pattern (see rollback
-- 00116 which made the same call), we instead emit a NOTICE pointing
-- the operator at re-applying 00116 to restore the exact prior body.
--
-- The schema additions (`vessel_names`, `vessel_flag_states`, the new
-- `vessels` columns) are owned by 00120's rollback — running 00121's
-- rollback alone leaves them in place, which is correct: 00121 only
-- changed the projection function, not the schema.

do $$
begin
  raise notice
    'Rollback for 00121: re-apply migration 00116_multi_nationality_projection.sql to restore the previous apply_projection body. The vessel_names / vessel_flag_states tables and the new vessels columns remain — drop them via 00120 rollback if you need a full reversal.';
end;
$$;
