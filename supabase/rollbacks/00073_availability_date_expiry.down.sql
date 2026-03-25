-- Rollback 00073: Revert per-date availability expiry to 7-day TTL
-- Approximate restore: set expires_at = created_at + 7 days for normal rows
UPDATE public.availability_windows
SET expires_at = created_at + interval '7 days'
WHERE not_available = false;

-- Restore the original apply_projection from 00072
-- (copy 00072's CREATE OR REPLACE here)
\i ../migrations/00072_consolidate_triggers.sql
