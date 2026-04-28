-- Rollback for 00128: Restore the source='curated' gate on REFERENCE.REQUESTED.
--
-- 00128 dropped the 3-line `source = 'curated'` check from the
-- REFERENCE.REQUESTED handler in apply_projection. To re-impose it,
-- re-apply 00126_references_projection.sql, which contains the original
-- gate at lines 672-674 of its apply_projection body.
--
-- NOTICE-only rollback (same pattern as 00126 / 00123).

do $$
begin
  raise notice
    'Rollback for 00128: re-apply 00126_references_projection.sql to restore the source=curated gate on REFERENCE.REQUESTED.';
end $$;
