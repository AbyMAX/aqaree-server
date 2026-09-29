const express = require('express');
const pool = require('../db/pool');
const { requireAuth, publicUser } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// Local digits canonical form so +249…, 0… and plain digits compare equal.
function canonicalPhone(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (!d) return '';
  return d.replace(/^(249|0)/, '');
}

// PUT /api/users/me { name?, email?, avatar?, role?, phone? }
router.put('/me', async (req, res) => {
  try {
    const { name, email, avatar, role, phone } = req.body || {};
    const fields = [];
    const vals = [];
    const set = (col, v) => {
      vals.push(v);
      fields.push(`${col} = $${vals.length}`);
    };
    if (name !== undefined) set('name', String(name).slice(0, 120));
    if (avatar !== undefined) set('avatar', String(avatar).slice(0, 500000));
    if (role !== undefined) set('role', String(role).slice(0, 40));
    if (phone !== undefined) {
      const canon = canonicalPhone(phone);
      if (canon) {
        const { rows: taken } = await pool.query(
          "SELECT id FROM users WHERE REGEXP_REPLACE(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), '^(249|0)', '') = $1 AND id <> $2",
          [canon, req.user.id]
        );
        if (taken[0]) {
          return res.status(400).json({ message: 'Phone number is already registered', code: 'PHONE_TAKEN' });
        }
      }
      set('phone', canon);
    }
    if (email !== undefined && String(email).includes('@')) {
      const clean = String(email).trim().toLowerCase();
      const { rows: taken } = await pool.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [
        clean,
        req.user.id,
      ]);
      if (taken[0]) return res.status(400).json({ message: 'Email is already in use' });
      set('email', clean);
    }
    if (!fields.length) {
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      return res.json(publicUser(rows[0]));
    }
    vals.push(req.user.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });
    return res.json(publicUser(rows[0]));
  } catch (err) {
    console.error('users/me:', err.message);
    return res.status(500).json({ message: 'Could not save profile' });
  }
});

module.exports = router;
