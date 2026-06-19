drop table if exists public.telegram_link_tokens;

alter table public.user_preferences drop column if exists telegram_enabled;

alter table public.notification_channels
  drop constraint if exists notification_channels_channel_type_check;

alter table public.notification_channels
  add constraint notification_channels_channel_type_check
  check (channel_type = 'whatsapp');
