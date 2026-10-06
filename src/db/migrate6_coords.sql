-- Step: stored map coordinates per listing (captured from the form map).
-- Run in Neon SQL Editor like the previous migrations.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
