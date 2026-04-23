-- =============================================================================
-- Rollback 00109: drop regions_country_code_format CHECK constraint
-- =============================================================================

alter table public.regions
  drop constraint if exists regions_country_code_format;
