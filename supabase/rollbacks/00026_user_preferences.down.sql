-- Rollback 00026: Drop user preferences table

drop policy if exists "Users can update own preferences" on public.user_preferences;
drop policy if exists "Users can insert own preferences" on public.user_preferences;
drop policy if exists "Users can read own preferences" on public.user_preferences;
drop table if exists public.user_preferences;
