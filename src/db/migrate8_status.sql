-- Step: listing moderation status (new listings hidden until approved).
-- Existing listings stay visible (default 'approved'); the app sets new
-- ones to 'pending' explicitly. Run in Neon SQL Editor like the others.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
