-- Step: device push tokens per account (Firebase Cloud Messaging).
-- Run in Neon SQL Editor like the previous migrations.
CREATE TABLE IF NOT EXISTS user_devices (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  platform   TEXT NOT NULL DEFAULT 'android',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices (user_id);
