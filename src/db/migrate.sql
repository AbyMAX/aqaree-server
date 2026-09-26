-- Aqaree backend: initial schema (steps 6-7).
-- Run once in Neon: SQL Editor -> New query -> paste -> Run.
-- Tables mirror the app's data shapes (users, properties, favorites,
-- transactions, news, faqs) plus otp_codes for the email-code login flow.

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  avatar      TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'Landlord',
  google_sub  TEXT UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS properties (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL DEFAULT '',
  title_ar    TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  location_ar TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  description_ar TEXT NOT NULL DEFAULT '',
  price       NUMERIC NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'SDG',
  phone       TEXT NOT NULL DEFAULT '',
  whatsapp    TEXT NOT NULL DEFAULT '',
  size        TEXT NOT NULL DEFAULT '',
  amenities   JSONB NOT NULL DEFAULT '[]',
  contact_name TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  listing_type TEXT NOT NULL DEFAULT 'Rent',
  type        TEXT NOT NULL DEFAULT 'House',
  beds        INTEGER NOT NULL DEFAULT 0,
  baths       INTEGER NOT NULL DEFAULT 0,
  images      JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, property_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL DEFAULT '',
  title_ar    TEXT NOT NULL DEFAULT '',
  spec        TEXT NOT NULL DEFAULT '',
  spec_ar     TEXT NOT NULL DEFAULT '',
  price       NUMERIC NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'SDG',
  agent       TEXT NOT NULL DEFAULT '',
  agent_ar    TEXT NOT NULL DEFAULT '',
  date_text   TEXT NOT NULL DEFAULT '',
  date_ar     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'progress',
  group_label TEXT NOT NULL DEFAULT '',
  group_ar    TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '',
  date_text   TEXT NOT NULL DEFAULT '',
  author      TEXT NOT NULL DEFAULT '',
  image       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faqs (
  id          SERIAL PRIMARY KEY,
  q           TEXT NOT NULL,
  q_ar        TEXT NOT NULL DEFAULT '',
  a           TEXT NOT NULL,
  a_ar        TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  code        TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes (email);
