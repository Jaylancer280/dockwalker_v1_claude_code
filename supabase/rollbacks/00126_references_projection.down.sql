-- Rollback for 00126: Restore the prior apply_projection body (no
-- references handlers, no references-aware extensions to PROFILE.CREATED /
-- EXPERIENCE.UPDATED / EXPERIENCE.REMOVED / PERSON.DATA_SCRUBBED).
--
-- Operators should re-run 00123_apply_projection_null_safety.sql to
-- restore the pre-references projection body. The references handlers
-- themselves are no-ops if 00125's tables don't exist; rolling back this
-- migration before 00125 is supported (the OLD projection body has no
-- references logic at all). If you also rolled back 00125, the schema is
-- consistent.
--
-- Same NOTICE-only rollback pattern as 00121 / 00122 / 00123.

do $$
begin
  raise notice
    'Rollback for 00126: re-apply migration 00123_apply_projection_null_safety.sql to restore the pre-references apply_projection body (handler count returns to 71).';
end $$;
