const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

function shape(n) {
  return {
    id: n.id,
    type: n.type || 'like',
    actorName: n.actor_name || '',
    propertyId: n.property_id,
    propertyTitle: n.property_title || '',
    propertyTitleAr: n.property_title_ar || '',
    read: !!n.is_read,
    createdAt: n.created_at,
  };
}

// GET /api/notifications -> mine, newest first
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    return res.json(rows.map(shape));
  } catch (err) {
    console.error('notifications list:', err.message);
    return res.status(500).json({ message: 'Could not load notifications' });
  }
});

// PUT /api/notifications/read -> mark all mine as read
router.put('/read', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('notifications read:', err.message);
    return res.status(500).json({ message: 'Could not update notifications' });
  }
});

module.exports = router;
