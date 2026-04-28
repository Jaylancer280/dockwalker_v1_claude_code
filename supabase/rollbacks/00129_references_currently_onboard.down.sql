-- Rollback for 00129: Restore the B-2 `is_current=true` gate on
-- REFERENCE.REQUESTED and the strict 4-field edit-lock (vessel/role/start/end
-- all unconditionally locked) on EXPERIENCE.UPDATED.
--
-- 00129 dropped the B-2 gate, loosened the edit-lock to allow the one-time
-- null→date end_date / true→false is_current transition on currently-onboard
-- experiences, and added the references snapshot_end_date auto-update.
-- Re-applying 00128 restores the prior behavior (which itself dropped the
-- source=curated check from 00126).
--
-- NOTICE-only rollback (same pattern as 00128 / 00126 / 00123).

do $$
begin
  raise notice
    'Rollback for 00129: re-apply 00128_references_pending_vessel_relaxation.sql to restore the B-2 is_current gate and the strict 4-field edit-lock on EXPERIENCE.UPDATED. Note: any references whose snapshot_end_date was auto-updated by 00129 will retain those values — the rollback does not undo data changes.';
end $$;
