require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');

const app = express();
const PORT = process.env.PORT || 8000;

// CORS: reflect the caller origin (web dev server, production domain,
// Android/iOS WebViews). Auth uses Bearer tokens (no cookies), so there is
// no CSRF surface and no origin allow-list to maintain.
// Behind Render's reverse proxy: trust it for correct client IPs
// (rate limiting and logging depend on this).
app.set('trust proxy', 1);
app.use(cors({ origin: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'aqaree-server', time: new Date().toISOString(), commit: String(process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7) });
});

// Step 6+: real routes mount here (auth, properties, favorites, ...)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/users', require('./routes/users'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api', require('./routes/content'));

// Android App Link verification for shared listing URLs.
app.get('/.well-known/assetlinks.json', (req, res) => {
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.sohouse.app',
        sha256_cert_fingerprints: [
          '9D:A9:EF:EF:D8:93:98:43:7A:48:C3:04:96:58:AA:F5:18:0E:33:99:E1:13:9C:B5:98:A5:FB:44:9C:D6:69:64',
        ],
      },
    },
  ]);
});

function escHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Shared listing landing page: opens the listing in the app when tapped
// on Android, shows a preview otherwise.
const { publicLimiter } = require('./rateLimit');
app.get('/property/:id', publicLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, title, location, price, currency, images FROM properties WHERE id = $1',
      [req.params.id]
    );
    const p = rows[0];
    if (!p) return res.status(404).send('Listing not found');
    const title = escHtml(p.title || 'Property');
    const loc = escHtml(p.location || '');
    const price = escHtml(`${Number(p.price) || 0} ${p.currency || 'SDG'}`);
    const img = Array.isArray(p.images) && p.images[0] ? escHtml(p.images[0]) : '';
    res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Aqaree</title></head><body style="margin:0;font-family:system-ui;background:#131316;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box"><div style="max-width:420px;width:100%;text-align:center">${img ? `<img src="${img}" alt="" style="width:100%;border-radius:16px;object-fit:cover;max-height:300px">` : ''}<h1 style="font-size:22px;margin:20px 0 6px">${title}</h1><p style="color:#9A9AA5;margin:0">${loc}</p><p style="font-size:20px;font-weight:700;margin:12px 0 24px">${price}</p><a href="aqaree://property/${p.id}" style="display:block;background:#1D4ED8;color:#fff;text-decoration:none;padding:16px;border-radius:12px;font-weight:700">Open in Aqaree app</a><p style="color:#9A9AA5;font-size:13px;margin-top:16px">افتح الإعلان في تطبيق عقاري</p></div></body></html>`);
  } catch (err) {
    console.error('property landing:', err.message);
    res.status(500).send('Could not load listing');
  }
});

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// Seed demo catalog on boot when tables are empty (safe to run always).
if (process.env.DATABASE_URL) {
  const { seedIfEmpty } = require('./db/seed');
  seedIfEmpty().catch((err) => console.error('seed:', err.message));
}

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

app.listen(PORT, () => {
  console.log(`aqaree-server listening on :${PORT}`);
});
