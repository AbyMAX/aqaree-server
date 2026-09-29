-- Step: persist the profile phone number per account.
-- Run in Neon SQL Editor like the previous migrations.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
