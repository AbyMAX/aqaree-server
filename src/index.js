require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// CORS: reflect the caller origin (web dev server, production domain,
// Android/iOS WebViews). Auth uses Bearer tokens (no cookies), so there is
// no CSRF surface and no origin allow-list to maintain.
app.use(cors({ origin: true }));
app.use(express.json({ limit: '25mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'aqaree-server', time: new Date().toISOString() });
});

// Step 6+: real routes mount here (auth, properties, favorites, ...)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api', require('./routes/content'));

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
