-- Migration 00112: Performance composite indexes
--
-- Adds 4 composite indexes that pair with actual hot-path query patterns
-- in the API layer, identified during the Fix 222j codebase audit.
--
-- Plain `create index` (not `concurrently`) is acceptable pre-launch given
-- low data volume and zero live write contention; brief table locks are
-- not user-visible. Revisit at scale.

-- 1. messages — last-message-per-engagement lookups (conversations list).
--    Existing idx_messages_engagement(engagement_id) forces a sort-in-memory
--    after the engagement filter. The DESC composite makes the order free,
--    so the .limit(200) added in Fix 222j becomes an indexed seek + scan.
create index if not exists idx_messages_engagement_created
  on public.messages (engagement_id, created_at desc);

-- 2. applications — daywork applicant review filters by daywork_id + status,
--    orders by created_at. Existing single-column indexes on daywork_id
--    and status individually force the planner to pick one and filter the
--    rest in memory.
create index if not exists idx_applications_daywork_status_created
  on public.applications (daywork_id, status, created_at desc);

-- 3. applications — same pattern for permanent posting review.
create index if not exists idx_applications_permanent_status_created
  on public.applications (permanent_posting_id, status, created_at desc);

-- 4. notifications — cron dedup queries filter by (person_id, type, created_at).
--    Existing idx_notifications_unread leads with (person_id, read, role_context)
--    so type-based dedup scans skip rows of unrelated types in memory.
create index if not exists idx_notifications_person_type_created
  on public.notifications (person_id, type, created_at desc);
