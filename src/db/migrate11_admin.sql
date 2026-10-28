-- Step 11: Aqaree Admin app support.
-- Run in Neon SQL Editor like the previous migrations (or via scripts/run-migration.js).
-- last_login_at: stamped on every successful login (email/password and Google).
-- admin_devices: FCM tokens of the Aqaree Admin app — the server pushes a
-- "new listing" alert to every token here, even when the app is closed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS admin_devices (
  token      TEXT PRIMARY KEY,
  platform   TEXT NOT NULL DEFAULT 'android',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
