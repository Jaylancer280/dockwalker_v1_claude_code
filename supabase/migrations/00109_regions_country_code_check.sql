-- =============================================================================
-- Migration 00109: CHECK (country_code ~ '^[A-Z]{2}$') on regions
--
-- `country_code` was added nullable in 00101 and populated via UUIDv5 upserts
-- in 00104 (marina expansion). The data is clean today — all production rows
-- either have `null` (pre-Locations-V1 legacy data, if any survived) or an
-- uppercase ISO-3166 alpha-2 code.
--
-- Admin canonical CRUD (00102 Phase E / 00104 Phase F) lets admins add
-- regions by hand. This constraint stops a typo like "gb" or "England" from
-- sneaking in and breaking the flag-emoji / country-filter code that
-- downstream queries rely on.
--
-- CHECK semantics: a NULL `country_code` passes the constraint (Postgres
-- treats NULL in a CHECK as not-false), so existing legacy rows without a
-- country code remain valid. Populated rows must match the regex exactly.
-- =============================================================================

alter table public.regions
  add constraint regions_country_code_format
  check (country_code ~ '^[A-Z]{2}$');
