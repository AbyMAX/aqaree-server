-- Step 8: email verification flag used by the OTP flow.
-- Run in Neon SQL Editor like the first migration.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
