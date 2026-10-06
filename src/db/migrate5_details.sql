-- Step: real floor + furnished status per listing (shown on details).
-- Run in Neon SQL Editor like the previous migrations.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS floor TEXT NOT NULL DEFAULT '';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS furnished TEXT NOT NULL DEFAULT '';
