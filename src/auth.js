const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';
const EXPIRES = '30d';

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    avatar: row.avatar || '',
    role: row.role || 'Landlord',
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
  };
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: EXPIRES });
}

// Protects private routes: req.user = { id, email }.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Admin gate: emails listed in ADMIN_EMAILS (Render env, comma-separated).
// No DB flag, so there's no chicken-and-egg on first setup.
function adminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function requireAdmin(req, res, next) {
  const email = String((req.user && req.user.email) || '').toLowerCase();
  if (!email || !adminEmails().includes(email)) {
    return res.status(403).json({ message: 'Admin access required', code: 'NOT_ADMIN' });
  }
  return next();
}

module.exports = { publicUser, signToken, requireAuth, requireAdmin };
