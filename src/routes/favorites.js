const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

function shapeProperty(row) {
  return {
    id: row.id,
    title: row.title || '',
    titleAr: row.title_ar || '',
    location: row.location || '',
    locationAr: row.location_ar || '',
    description: row.description || '',
    descriptionAr: row.description_ar || '',
    price: Number(row.price) || 0,
    currency: row.currency || 'SDG',
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
    type: row.type || 'House',
    beds: Number(row.beds) || 0,
    baths: Number(row.baths) || 0,
    image: (row.images && row.images[0]) || '',
    images: row.images || [],
  };
}

// GET /api/favorites -> this user's saved properties
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.* FROM favorites f JOIN properties p ON p.id = f.property_id
       WHERE f.user_id = $1 ORDER BY p.id DESC`,
      [req.user.id]
    );
    return res.json(rows.map(shapeProperty));
  } catch (err) {
    console.error('favorites list:', err.message);
    return res.status(500).json({ message: 'Could not load favorites' });
  }
});

// POST /api/favorites { propertyId }
router.post('/', async (req, res) => {
  try {
    const { propertyId } = req.body || {};
    if (!propertyId) return res.status(400).json({ message: 'propertyId is required' });
    await pool.query(
      'INSERT INTO favorites (user_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, propertyId]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('favorite add:', err.message);
    return res.status(500).json({ message: 'Could not save favorite' });
  }
});

// DELETE /api/favorites/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM favorites WHERE user_id = $1 AND property_id = $2', [
      req.user.id,
      req.params.id,
    ]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('favorite remove:', err.message);
    return res.status(500).json({ message: 'Could not remove favorite' });
  }
});

module.exports = router;
