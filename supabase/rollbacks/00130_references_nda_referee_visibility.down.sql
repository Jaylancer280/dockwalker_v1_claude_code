-- Rollback for 00130: Restore the NDA write-time gate on REFERENCE.REQUESTED.
--
-- 00130 dropped the NDA block from the REFERENCE.REQUESTED handler in
-- apply_projection. Re-applying 00129 restores the prior body (which
-- still had the NDA gate present alongside the relaxed B-2 / closing-
-- transition logic from that migration).
--
-- The display-layer mask added by 00130 lives in route code
-- (`/api/messages/[engagementId]/context`) and is not undone by this
-- rollback. To fully revert NDA visibility behaviour, also revert the
-- corresponding application-layer changes.
--
-- NOTICE-only rollback (same pattern as 00129 / 00128 / 00126).

do $$
begin
  raise notice
    'Rollback for 00130: re-apply 00129_references_currently_onboard.sql to restore the NDA write-time gate on REFERENCE.REQUESTED. Note: display-layer NDA masking in /api/messages/[engagementId]/context lives in application code and is unaffected by this rollback.';
end $$;
