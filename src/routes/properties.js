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
    floor: row.floor || '',
    furnished: row.furnished || '',
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
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
  const toCoord = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
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
    floor: body.floor != null ? String(body.floor).replace(/\D/g, '') : '',
    furnished: body.furnished === 'furnished' || body.furnished === 'unfurnished' ? body.furnished : '',
    latitude: toCoord(body.latitude),
    longitude: toCoord(body.longitude),
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

// The production DB was built by hand-run migrations, so any column may
// be missing. If Postgres complains about an undefined column, drop just
// that column and retry (bounded by the column count) instead of 500ing.
function dropMissing(cols, vals, err) {
  const m = err && err.message && err.message.match(/column "([^"]+)" does not exist/);
  if (!m || !cols.includes(m[1]) || cols.length <= 5) return null;
  console.error(`property write without missing column "${m[1]}":`, err.message);
  const i = cols.indexOf(m[1]);
  return [
    [...cols.slice(0, i), ...cols.slice(i + 1)],
    [...vals.slice(0, i), ...vals.slice(i + 1)],
  ];
}

async function insertProperty(cols, vals) {
  const ph = cols.map((_, i) => `$${i + 1}`).join(',');
  try {
    const { rows } = await pool.query(
      `INSERT INTO properties (${cols.join(', ')}) VALUES (${ph}) RETURNING id`,
      vals
    );
    return rows[0].id;
  } catch (err) {
    const retry = err && err.code === '42703' ? dropMissing(cols, vals, err) : null;
    if (retry) return insertProperty(retry[0], retry[1]);
    throw err;
  }
}

async function updateProperty(id, pairs) {
  const set = pairs.map(([c], i) => `${c}=$${i + 1}`).join(', ');
  const vals = [...pairs.map(([, v]) => v), id];
  try {
    await pool.query(`UPDATE properties SET ${set} WHERE id=$${pairs.length + 1}`, vals);
  } catch (err) {
    const cols = pairs.map(([c]) => c);
    const retry =
      err && err.code === '42703'
        ? dropMissing(cols, vals.slice(0, -1), err)
        : null;
    if (retry) {
      return updateProperty(
        id,
        retry[0].map((c, i) => [c, retry[1][i]])
      );
    }
    throw err;
  }
}

// POST /api/properties (multipart or JSON)
router.post('/', requireAuth, upload.array('photos', 12), async (req, res) => {
  try {
    const b = pickBody(req.body);
    const images = await resolveImages(req, req.body);
    const cols = [
      'owner_id', 'title', 'title_ar', 'location', 'location_ar', 'description',
      'description_ar', 'price', 'currency', 'phone', 'whatsapp', 'size',
      'amenities', 'floor', 'furnished', 'latitude', 'longitude', 'contact_name', 'email',
      'listing_type', 'type', 'beds', 'baths', 'images',
    ];
    const vals = [
      req.user.id, b.title, b.titleAr, b.location, b.locationAr, b.description,
      b.descriptionAr, b.price, b.currency, b.phone, b.whatsapp, b.size,
      JSON.stringify(b.amenities), b.floor, b.furnished, b.latitude, b.longitude, b.contactName, b.email, b.listingType,
      b.type, b.beds, b.baths, JSON.stringify(images),
    ];
    const id = await insertProperty(cols, vals);
    const { rows: full } = await pool.query(`${WITH_OWNER} WHERE p.id = $1`, [id]);
    return res.status(201).json(shapeProperty(full[0]));
  } catch (err) {
    console.error('property create:', err.message);
    return res.status(500).json({ message: 'Could not create listing', diag: String((err && err.message) || err).slice(0, 300) });
  }
});

// PUT /api/properties/:id — owner only
router.put('/:id', requireAuth, upload.array('photos', 12), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM properties WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ message: 'Property not found' });
    if (Number(existing[0].owner_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'You can only edit your own listings' });
    }
    const b = pickBody(req.body);
    const uploaded = await resolveImages(req, req.body);
    const bodyPhotos = Array.isArray(req.body.photos) ? req.body.photos : [];
    // resolveImages already processed body photos (uploaded data-URLs to
    // Cloudinary, passed plain URLs through) — use it directly instead
    // of merging the raw body photos a second time.
    const images = uploaded.length || bodyPhotos.length ? uploaded : existing[0].images;
    const keepImages = Array.isArray(images) ? images : existing[0].images;

    await updateProperty(req.params.id, [
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
      ['images', JSON.stringify(keepImages)],
    ]);
    const { rows: full } = await pool.query(`${WITH_OWNER} WHERE p.id = $1`, [req.params.id]);
    return res.json(shapeProperty(full[0]));
  } catch (err) {
    console.error('property update:', err.message);
    return res.status(500).json({ message: 'Could not update listing' });
  }
});

// DELETE /api/properties/:id — owner only. Dependents first so demo
// listings with favorites/notifications delete cleanly too.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT owner_id FROM properties WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ message: 'Property not found' });
    if (Number(existing[0].owner_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'You can only delete your own listings' });
    }
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
