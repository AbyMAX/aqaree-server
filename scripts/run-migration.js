// Applies a numbered migration SQL file using the server's DATABASE_URL.
// Usage: node scripts/run-migration.js src/db/migrate11_admin.sql
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node scripts/run-migration.js <sql-file>');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  try {
    await pool.query(sql);
    console.log('OK:', file);
    process.exit(0);
  } catch (err) {
    console.error('FAILED:', err.message);
    process.exit(1);
  }
})();
