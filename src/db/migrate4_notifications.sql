-- Step: real notifications (e.g. someone likes your property).
-- Run in Neon SQL Editor like the previous migrations.
CREATE TABLE IF NOT EXISTS notifications (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name    TEXT NOT NULL DEFAULT '',
  type          TEXT NOT NULL DEFAULT 'like',
  property_id   INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  property_title TEXT NOT NULL DEFAULT '',
  property_title_ar TEXT NOT NULL DEFAULT '',
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);
