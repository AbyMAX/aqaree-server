const { Pool } = require('pg');

// Neon requires SSL. The pooled connection string already carries sslmode.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

pool.on('error', (err) => console.error('pg pool error', err.message));

module.exports = pool;
