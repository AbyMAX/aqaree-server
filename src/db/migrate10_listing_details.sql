-- Step: listing category + rental terms.
-- New listings store category (Residential/Commercial/Land/Farm) and,
-- when rented, lease length months + payment frequency. Existing rows
-- get defaults so old listings keep working.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Residential';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS lease_length INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS payment_frequency TEXT;
