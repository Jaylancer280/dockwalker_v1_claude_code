-- Rollback: remove whatsapp_enabled column, drop notification_channels table
alter table public.user_preferences drop column if exists whatsapp_enabled;

drop policy if exists "Owner can delete own channels" on public.notification_channels;
drop policy if exists "Owner can update own channels" on public.notification_channels;
drop policy if exists "Owner can insert own channels" on public.notification_channels;
drop policy if exists "Owner can read own channels" on public.notification_channels;
drop table if exists public.notification_channels;
