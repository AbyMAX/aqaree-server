const express = require('express');
const multer = require('multer');
const pool = require('../db/pool');
const { requireAuth } = require('../auth');
const { configured, uploadBuffer, uploadDataUrl } = require('../cloudinary');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 12 } });

// Same type mapping the app's filter screen uses.
const TYPE_MAP = { Apartments: 'Apartment', Condominiums: 'Condo', Houses: 'House' };

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
    size: row.size || '',
    amenities: row.amenities || [],
    contactName: row.contact_name || '',
    email: row.email || '',
    listingType: row.listing_type || 'Rent',
    type: row.type || 'House',
    beds: Number(row.beds) || 0,
    baths: Number(row.baths) || 0,
    image: (row.images && row.images[0]) || '',
    images: row.images || [],
    owner: row.owner_id
      ? { name: row.owner_name || '', avatar: row.owner_avatar || '', email: row.owner_email || '', role: row.owner_role || 'Landlord' }
      : undefined,
    createdAt: row.created_at,
  };
}

const WITH_OWNER = `
  SELECT p.*,
         u.name AS owner_name, u.avatar AS owner_avatar,
         u.email AS owner_email, u.role AS owner_role
  FROM properties p LEFT JOIN users u ON u.id = p.owner_id`;

// GET /api/properties?q=&sort=&min=&max=&type=&beds=&baths=
router.get('/', async (req, res) => {
  try {
    const { q, sort, min, max, type, beds, baths } = req.query;
    const conds = [];
    const vals = [];
    const add = (sql, v) => {
      vals.push(v);
      conds.push(sql.replace('?', `$${vals.length}`));
    };

    if (type) add('p.type = ?', TYPE_MAP[type] || type);
    if (beds && beds !== '5+') add('p.beds = ?', Number(beds));
    if (beds === '5+') conds.push('p.beds >= 5');
    if (baths && baths !== '5+') add('p.baths = ?', Number(baths));
    if (baths === '5+') conds.push('p.baths >= 5');
    if (min) add('p.price >= ?', Number(min));
    if (max) add('p.price <= ?', Number(max));
    if (q) {
      vals.push(`%${q}%`);
      const n = vals.length;
      conds.push(`(p.title ILIKE $${n} OR p.title_ar ILIKE $${n} OR p.location ILIKE $${n} OR p.location_ar ILIKE $${n} OR p.type ILIKE $${n})`);
    }

    let order = 'p.id DESC';
    if (sort === 'Lowest Price') order = 'p.price ASC';
    else if (sort === 'Highest Price') order = 'p.price DESC';

    const { rows } = await pool.query(
      `${WITH_OWNER}${conds.length ? ` WHERE ${conds.join(' AND ')}` : ''} ORDER BY ${order} LIMIT 200`,
      vals
    );
    return res.json(rows.map(shapeProperty));
  } catch (err) {
    console.error('properties list:', err.message);
    return res.status(500).json({ message: 'Could not load properties' });
  }
});

// GET /api/properties/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`${WITH_OWNER} WHERE p.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Property not found' });
    return res.json(shapeProperty(rows[0]));
  } catch (err) {
    console.error('property get:', err.message);
    return res.status(500).json({ message: 'Could not load property' });
  }
});

function pickBody(body = {}) {
  const num = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  };
  const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : [v];
      } catch {
        return v ? [v] : [];
      }
    }
    return [];
  };
  return {
    title: body.title || '',
    titleAr: body.titleAr || body.title || '',
    location: body.location || '',
    locationAr: body.locationAr || body.location || '',
    description: body.description || '',
    descriptionAr: body.descriptionAr || body.description || '',
    price: Number(body.price) || 0,
    currency: body.currency || 'SDG',
    phone: body.phone || '',
    whatsapp: body.whatsapp || '',
    size: body.size != null ? String(body.size) : '',
    amenities: asArray(body.amenities),
    contactName: body.contactName || body.contact_name || '',
    email: body.email || '',
    listingType: body.listingType || body.listing_type || 'Rent',
    type: body.propertyType || body.type || 'House',
    beds: num(body.bedrooms ?? body.beds),
    baths: num(body.bathrooms ?? body.baths),
  };
}

// Photos arrive as multipart `photos` (≤12). Data-URL strings in the JSON
// body are also accepted (offline-created drafts + the app photo picker).
async function resolveImages(req, body) {
  const urls = [];
  if (configured && req.files && req.files.length) {
    for (const f of req.files.slice(0, 12)) {
      // eslint-disable-next-line no-await-in-loop
      urls.push(await uploadBuffer(f.buffer));
    }
  }
  const fromBody = Array.isArray(body.photos) ? body.photos : [];
  for (const p of fromBody) {
    if (typeof p !== 'string' || !p) continue;
    if (p.startsWith('data:')) {
      if (!configured) continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        urls.push(await uploadDataUrl(p));
      } catch (err) {
        console.error('photo upload:', err.message);
      }
    } else {
      urls.push(p);
    }
    if (urls.length >= 12) break;
  }
  return urls.slice(0, 12);
}

// POST /api/properties (multipart or JSON)
router.post('/', requireAuth, upload.array('photos', 12), async (req, res) => {
  try {
    const b = pickBody(req.body);
    const images = await resolveImages(req, req.body);
    const { rows } = await pool.query(
      `INSERT INTO properties
        (owner_id, title, title_ar, location, location_ar, description, description_ar,
         price, currency, phone, whatsapp, size, amenities, contact_name, email,
         listing_type, type, beds, baths, images)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id`,
      [
        req.user.id, b.title, b.titleAr, b.location, b.locationAr, b.description,
        b.descriptionAr, b.price, b.currency, b.phone, b.whatsapp, b.size,
        JSON.stringify(b.amenities), b.contactName, b.email, b.listingType,
        b.type, b.beds, b.baths, JSON.stringify(images),
      ]
    );
    const { rows: full } = await pool.query(`${WITH_OWNER} WHERE p.id = $1`, [rows[0].id]);
    return res.status(201).json(shapeProperty(full[0]));
  } catch (err) {
    console.error('property create:', err.message);
    return res.status(500).json({ message: 'Could not create listing' });
  }
});

// PUT /api/properties/:id — owner only (or any signed-in user in this build)
router.put('/:id', requireAuth, upload.array('photos', 12), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM properties WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ message: 'Property not found' });
    const b = pickBody(req.body);
    const uploaded = await resolveImages(req, req.body);
    const bodyPhotos = Array.isArray(req.body.photos) ? req.body.photos : [];
    const images = [...uploaded, ...bodyPhotos].slice(0, 12);
    const keepImages = uploaded.length || bodyPhotos.length ? images : existing[0].images;

    await pool.query(
      `UPDATE properties SET title=$1, title_ar=$2, location=$3, location_ar=$4,
        description=$5, description_ar=$6, price=$7, currency=$8, phone=$9, whatsapp=$10,
        size=$11, amenities=$12, contact_name=$13, email=$14, listing_type=$15,
        type=$16, beds=$17, baths=$18, images=$19 WHERE id=$20`,
      [
        b.title, b.titleAr, b.location, b.locationAr, b.description, b.descriptionAr,
        b.price, b.currency, b.phone, b.whatsapp, b.size, JSON.stringify(b.amenities),
        b.contactName, b.email, b.listingType, b.type, b.beds, b.baths,
        JSON.stringify(keepImages), req.params.id,
      ]
    );
    const { rows: full } = await pool.query(`${WITH_OWNER} WHERE p.id = $1`, [req.params.id]);
    return res.json(shapeProperty(full[0]));
  } catch (err) {
    console.error('property update:', err.message);
    return res.status(500).json({ message: 'Could not update listing' });
  }
});

// DELETE /api/properties/:id — dependents first so demo listings
// with favorites/notifications delete cleanly too.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM favorites WHERE property_id = $1', [req.params.id]);
    await pool.query('DELETE FROM notifications WHERE property_id = $1', [req.params.id]);
    await pool.query('DELETE FROM properties WHERE id = $1', [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('property delete:', err.message);
    return res.status(500).json({ message: 'Could not delete listing' });
  }
});

module.exports = router;
