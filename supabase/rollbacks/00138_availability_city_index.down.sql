-- Rollback for 00138_availability_city_index.sql

drop index if exists public.idx_availability_city_date_expires;
