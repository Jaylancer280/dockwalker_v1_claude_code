-- =============================================================================
-- Rollback 00049: Drop daywork_templates UPDATE policy
-- =============================================================================

drop policy if exists "Owner can update own templates" on public.daywork_templates;
