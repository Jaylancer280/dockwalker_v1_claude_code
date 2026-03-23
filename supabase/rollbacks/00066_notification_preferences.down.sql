-- Rollback: remove notification preference columns from user_preferences
ALTER TABLE user_preferences
  DROP COLUMN IF EXISTS email_enabled,
  DROP COLUMN IF EXISTS push_jobs,
  DROP COLUMN IF EXISTS push_applications,
  DROP COLUMN IF EXISTS push_messages,
  DROP COLUMN IF EXISTS push_reminders;
