-- Add notification preference columns to user_preferences
ALTER TABLE user_preferences
  ADD COLUMN email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN push_jobs boolean NOT NULL DEFAULT true,
  ADD COLUMN push_applications boolean NOT NULL DEFAULT true,
  ADD COLUMN push_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN push_reminders boolean NOT NULL DEFAULT true;
