const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../auth');
const { loginLimiter } = require('../rateLimit');
const { pushToUser } = require('../push');
const props = require('./properties');

const router = express.Router();

// Dedicated admin login: username + password from Render env
// (ADMIN_USER / ADMIN_PASSWORD). Secrets stay out of the code;
// rotate by changing the env values (Render redeploys automatically).
function adminCreds() {
  return {
    user: String(process.env.ADMIN_USER || '').trim(),
    pass: String(process.env.ADMIN_PASSWORD || ''),
  };
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

// POST /api/admin/login { username, password } -> { token }
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const creds = adminCreds();
    if (!creds.user || !creds.pass) {
      return res.status(500).json({ message: 'Admin login is not configured' });
    }
    if (!username || !safeEqual(username, creds.user) || !safeEqual(password || '', creds.pass)) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }
    const token = jwt.sign({ admin: true, name: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token, user: { name: 'Administrator', email: '', role: 'Admin' } });
  } catch (err) {
    console.error('admin login:', err.message);
    return res.status(500).json({ message: 'Admin login failed' });
  }
});

router.use(requireAuth, requireAdmin);

function adminUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    avatar: row.avatar || '',
    role: row.role || 'Landlord',
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
    email_verified: !!row.email_verified,
    created_at: row.created_at,
  };
}

// GET /api/admin/stats -> table counts.
router.get('/stats', async (req, res) => {
  try {
    const [[u], [p], [f]] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS n FROM users').then((r) => r.rows),
      pool.query('SELECT COUNT(*)::int AS n FROM properties').then((r) => r.rows),
      pool.query('SELECT COUNT(*)::int AS n FROM favorites').then((r) => r.rows),
    ]);
    return res.json({ users: u.n, properties: p.n, favorites: f.n });
  } catch (err) {
    console.error('admin stats:', err.message);
    return res.status(500).json({ message: 'Could not load stats' });
  }
});

// GET /api/admin/users?q=&limit= -> newest first, no password hashes.
router.get('/users', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const vals = [];
    let where = '';
    if (q) {
      vals.push(`%${q}%`);
      where = `WHERE email ILIKE $1 OR name ILIKE $1`;
    }
    const { rows } = await pool.query(
      `SELECT * FROM users ${where} ORDER BY id DESC LIMIT ${limit}`,
      vals
    );
    return res.json(rows.map(adminUser));
  } catch (err) {
    console.error('admin users:', err.message);
    return res.status(500).json({ message: 'Could not load users' });
  }
});

// PUT /api/admin/users/:id { name?, role?, phone?, whatsapp?, avatar?, email_verified? }
router.put('/users/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const fields = [];
    const vals = [];
    const set = (col, v) => {
      vals.push(v);
      fields.push(`${col} = $${vals.length}`);
    };
    if (body.name !== undefined) set('name', String(body.name).slice(0, 120));
    if (body.avatar !== undefined) set('avatar', String(body.avatar).slice(0, 500000));
    if (body.role !== undefined) set('role', String(body.role).slice(0, 40));
    if (body.phone !== undefined) {
      const canon = String(body.phone || '').replace(/\D/g, '').replace(/^(249|0)/, '');
      if (canon) {
        const { rows: taken } = await pool.query(
          "SELECT id FROM users WHERE REGEXP_REPLACE(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), '^(249|0)', '') = $1 AND id <> $2",
          [canon, req.params.id]
        );
        if (taken[0]) return res.status(400).json({ message: 'Phone number is already registered', code: 'PHONE_TAKEN' });
      }
      set('phone', canon);
    }
    if (body.whatsapp !== undefined) {
      set('whatsapp', String(body.whatsapp || '').replace(/\D/g, '').replace(/^(249|0)/, ''));
    }
    if (body.email_verified !== undefined) set('email_verified', !!body.email_verified);
    if (!fields.length) {
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
      return res.json(adminUser(rows[0]));
    }
    vals.push(req.params.id);
    try {
      const { rows } = await pool.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${vals.length} RETURNING *`,
        vals
      );
      if (!rows[0]) return res.status(404).json({ message: 'User not found' });
      return res.json(adminUser(rows[0]));
    } catch (err) {
      // whatsapp column may predate the migration — save the rest.
      const m = err && err.message && err.message.match(/column "([^"]+)"/);
      if (m && m[1] === 'whatsapp') {
        const keep = fields.filter((f) => !f.startsWith('whatsapp ='));
        if (keep.length !== fields.length) {
          const bare = keep.map((f) => f.split(' = ')[0]);
          const { rows } = await pool.query(
            `UPDATE users SET ${keep.join(', ')} WHERE id = $${keep.length + 1} RETURNING *`,
            [...bare.map((c) => vals[fields.findIndex((f) => f.startsWith(c + ' ='))]), req.params.id]
          );
          if (!rows[0]) return res.status(404).json({ message: 'User not found' });
          return res.json(adminUser(rows[0]));
        }
      }
      throw err;
    }
  } catch (err) {
    console.error('admin user update:', err.message);
    return res.status(500).json({ message: 'Could not save user' });
  }
});

// DELETE /api/admin/users/:id -> user + their favorites + their listings.
router.delete('/users/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });
    const { rows: owned } = await pool.query('SELECT id FROM properties WHERE owner_id = $1', [req.params.id]);
    for (const r of owned) {
      // eslint-disable-next-line no-await-in-loop
      await props.deletePropertyCascade(r.id);
    }
    await pool.query('DELETE FROM favorites WHERE user_id = $1', [req.params.id]);
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [req.params.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    return res.json({ ok: true, removedListings: owned.length });
  } catch (err) {
    console.error('admin user delete:', err.message);
    return res.status(500).json({ message: 'Could not delete user' });
  }
});

// GET /api/admin/properties?q=&limit= -> newest first with owner email.
router.get('/properties', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const vals = [];
    let where = '';
    if (q) {
      vals.push(`%${q}%`);
      const n = vals.length;
      where = `WHERE (p.title ILIKE $${n} OR p.location ILIKE $${n})`;
    }
    const { rows } = await pool.query(
      `SELECT p.*, u.email AS owner_email FROM properties p LEFT JOIN users u ON u.id = p.owner_id ${where} ORDER BY p.id DESC LIMIT ${limit}`,
      vals
    );
    return res.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title || '',
        location: r.location || '',
        price: Number(r.price) || 0,
        currency: r.currency || 'SDG',
        type: r.type || '',
        beds: Number(r.beds) || 0,
        status: r.status || 'approved',
        owner_email: r.owner_email || '',
        created_at: r.created_at,
      }))
    );
  } catch (err) {
    console.error('admin properties:', err.message);
    return res.status(500).json({ message: 'Could not load properties' });
  }
});

// PUT /api/admin/properties/:id -> same write path as the app (tolerates
// pending migrations). Accepts the listing-form payload + images[] URLs.
router.put('/properties/:id', async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM properties WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ message: 'Property not found' });
    const prev = existing[0];
    // Bridge DB snake_case to the form's camelCase so untouched fields
    // (e.g. the Arabic title) survive a partial edit.
    const b = props.pickBody({
      titleAr: prev.title_ar,
      locationAr: prev.location_ar,
      descriptionAr: prev.description_ar,
      ...prev,
      ...(req.body || {}),
    });
    const bodyImages = Array.isArray((req.body || {}).images)
      ? (req.body.images || []).filter((x) => typeof x === 'string' && x)
      : existing[0].images;
    const pairs = [
      ['title', b.title], ['title_ar', b.titleAr], ['location', b.location],
      ['location_ar', b.locationAr], ['description', b.description],
      ['description_ar', b.descriptionAr], ['price', b.price], ['currency', b.currency],
      ['phone', b.phone], ['whatsapp', b.whatsapp], ['size', b.size],
      ['amenities', JSON.stringify(b.amenities)],
      ['floor', b.floor], ['furnished', b.furnished],
      ['latitude', b.latitude], ['longitude', b.longitude],
      ['contact_name', b.contactName], ['email', b.email],
      ['listing_type', b.listingType], ['type', b.type],
      ['beds', b.beds], ['baths', b.baths],
      ['images', JSON.stringify(Array.isArray(bodyImages) ? bodyImages : [])],
      ...(b.status ? [['status', b.status]] : []),
    ];
    await props.updateProperty(req.params.id, pairs);
    // Notify the owner when moderation flips the listing's fate.
    try {
      const prevStatus = prev.status || 'approved';
      if (b.status && (b.status === 'approved' || b.status === 'rejected') && b.status !== prevStatus && prev.owner_id) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, property_id, property_title, property_title_ar)
           VALUES ($1, $2, $3, $4, $5)`,
          [prev.owner_id, b.status, prev.id, prev.title || '', prev.title_ar || '']
        );
        pushToUser(prev.owner_id, {
          title: b.status === 'approved' ? 'تم اضافة منشورك بنجاح' : 'لم تتم الموافقة على منشورك',
          body: prev.title || '',
          data: { propertyId: prev.id, route: `/property/${prev.id}`, type: b.status },
        }).catch(() => {});
      }
    } catch (notifyErr) {
      console.error('moderation notify:', notifyErr.message);
    }
    const { rows: full } = await pool.query('SELECT * FROM properties WHERE id = $1', [req.params.id]);
    return res.json({ ok: true, id: full[0].id });
  } catch (err) {
    console.error('admin property update:', err.message);
    return res.status(500).json({ message: 'Could not save listing' });
  }
});

// DELETE /api/admin/properties/:id
router.delete('/properties/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id FROM properties WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Property not found' });
    await props.deletePropertyCascade(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('admin property delete:', err.message);
    return res.status(500).json({ message: 'Could not delete listing' });
  }
});

module.exports = router;
