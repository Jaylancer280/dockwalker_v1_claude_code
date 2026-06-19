-- 00138_availability_city_index.sql
--
-- Composite index on availability_windows(city_id, date, expires_at)
-- to support the available-crew tab's region-scoped query: filter by
-- city_id IN (region's cities) AND date BETWEEN start AND end AND
-- expires_at > now(). The original column from migration 00024 had no
-- index, which was fine while the table was tiny but won't scale once
-- more crew set availability and posts span the full Locations V2
-- region map (avg ~53 cities per region).
--
-- Plain CREATE INDEX (not CONCURRENTLY) is fine pre-launch — no live
-- write contention to worry about. Switch to CONCURRENTLY if applying
-- to a hot table post-launch.

create index if not exists idx_availability_city_date_expires
  on public.availability_windows (city_id, date, expires_at);
