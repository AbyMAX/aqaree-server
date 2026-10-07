-- Step: WhatsApp number per account (used as listing contact info).
-- Run in Neon SQL Editor like the previous migrations.
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp TEXT NOT NULL DEFAULT '';
