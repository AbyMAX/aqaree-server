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

// GET /api/notifications/unread-count -> { count } (cheap badge poll)
router.get('/unread-count', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    return res.json({ count: rows[0].n });
  } catch (err) {
    console.error('notifications count:', err.message);
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

// DELETE /api/notifications/:id -> dismiss one of mine
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE user_id = $1 AND id = $2', [req.user.id, req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('notifications delete:', err.message);
    return res.status(500).json({ message: 'Could not delete notification' });
  }
});

// DELETE /api/notifications -> clear all mine
router.delete('/', async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [req.user.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('notifications clear:', err.message);
    return res.status(500).json({ message: 'Could not clear notifications' });
  }
});

module.exports = router;
