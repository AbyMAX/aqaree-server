require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// Only our frontend(s) may call this API.
const allowed = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: allowed }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'aqaree-server', time: new Date().toISOString() });
});

// Step 6+: real routes mount here (auth, properties, favorites, ...)
// app.use('/api/auth', require('./routes/auth'));

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

app.listen(PORT, () => {
  console.log(`aqaree-server listening on :${PORT}`);
});
