-- Add last_notified_contest column to existing push_subscriptions table
-- Run this if you already executed 002 without this column
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS last_notified_contest JSONB DEFAULT '{}';
