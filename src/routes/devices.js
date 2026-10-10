const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/devices { token, platform? } -> upsert this user's push token.
router.post('/', async (req, res) => {
  try {
    const token = String((req.body || {}).token || '').trim();
    if (!token || token.length < 20) {
      return res.status(400).json({ message: 'Push token is required' });
    }
    const platform = String((req.body || {}).platform || 'android').slice(0, 20);
    await pool.query(
      `INSERT INTO user_devices (user_id, token, platform, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3, updated_at = NOW()`,
      [req.user.id, token, platform]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('devices:', err.message);
    return res.status(500).json({ message: 'Could not save push token' });
  }
});

module.exports = router;
