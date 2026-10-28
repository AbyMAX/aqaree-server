const express = require('express');
const pool = require('../db/pool');
const { requireAuth, publicUser } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// Best-effort removal of the account's listing photos from Cloudinary.
// Photos uploaded through /api/uploads/sign land in the "aqaree" folder, so
// the public id is the path after "/upload/". Never fails the deletion.
function cloudinaryPublicId(url) {
  try {
    const m = String(url || '').match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function destroyCloudinaryImages(urls) {
  try {
    const cloudinary = require('cloudinary').v2;
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return;
    const ids = [...new Set(urls.map(cloudinaryPublicId).filter(Boolean))];
    for (const id of ids) {
      try { await cloudinary.uploader.destroy(id, { invalidate: true }); } catch { /* keep going */ }
    }
  } catch { /* never block account deletion on media cleanup */ }
}

// DELETE /api/users/me — in-app account deletion (Play policy requirement).
// Removes the account and everything tied to it: listings (+ their photos on
// Cloudinary), favorites, notifications, push tokens, OTP codes. Transactions
// keep their rows but lose the user reference (SET NULL) for bookkeeping.
router.delete('/me', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Collect listing photos for Cloudinary cleanup before deleting rows.
    const { rows: props } = await client.query(
      'SELECT images FROM properties WHERE owner_id = $1',
      [req.user.id]
    );
    const imageUrls = [];
    for (const p of props) {
      if (Array.isArray(p.images)) imageUrls.push(...p.images.filter(Boolean));
    }

    await client.query('DELETE FROM properties WHERE owner_id = $1', [req.user.id]);
    await client.query('DELETE FROM favorites WHERE user_id = $1', [req.user.id]);
    await client.query('DELETE FROM notifications WHERE user_id = $1', [req.user.id]);
    await client.query('DELETE FROM user_devices WHERE user_id = $1', [req.user.id]);
    await client.query('DELETE FROM otp_codes WHERE email = (SELECT email FROM users WHERE id = $1)', [req.user.id]);
    const { rowCount } = await client.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found' });
    }

    await client.query('COMMIT');
    // Media cleanup after the DB is committed — best effort, outside the tx.
    destroyCloudinaryImages(imageUrls);
    return res.json({ ok: true });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('users/me DELETE:', err.message);
    return res.status(500).json({ message: 'Could not delete account' });
  } finally {
    client.release();
  }
});

// Local digits canonical form so +249…, 0… and plain digits compare equal.
function canonicalPhone(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (!d) return '';
  return d.replace(/^(249|0)/, '');
}

// PUT /api/users/me { name?, email?, avatar?, role?, phone?, whatsapp? }
router.put('/me', async (req, res) => {
  try {
    const { name, email, avatar, role, phone, whatsapp } = req.body || {};
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
    if (whatsapp !== undefined) set('whatsapp', canonicalPhone(whatsapp));
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
