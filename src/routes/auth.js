const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { publicUser, signToken } = require('../auth');
const { sendOtpEmail } = require('../mail');

const router = express.Router();
const OTP_TTL_MIN = 10;

const otpCode = () => String(Math.floor(100000 + Math.random() * 900000));

// POST /api/auth/register { email, password } -> creates/updates the user,
// stores a fresh OTP and emails it. Frontend then moves to /verify-otp.
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    if (String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const cleanEmail = String(email).trim().toLowerCase();
    const hash = await bcrypt.hash(String(password), 10);
    const name = cleanEmail.split('@')[0].replace(/[._-]+/g, ' ').trim() || 'Guest';

    await pool.query(
      `INSERT INTO users (email, password_hash, name, email_verified)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, email_verified = FALSE`,
      [cleanEmail, hash, name]
    );
    await pool.query('DELETE FROM otp_codes WHERE email = $1', [cleanEmail]);
    const code = otpCode();
    await pool.query(
      `INSERT INTO otp_codes (email, code, expires_at) VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
      [cleanEmail, code, String(OTP_TTL_MIN)]
    );
    await sendOtpEmail(cleanEmail, code);
    return res.json({ ok: true });
  } catch (err) {
    console.error('register:', err.message);
    return res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/verify-otp { code } -> marks the matching email verified.
router.post('/verify-otp', async (req, res) => {
  try {
    const { code, email } = req.body || {};
    if (!code) return res.status(400).json({ message: 'Code is required' });

    // The app sends just { code }; the email comes from the pending session.
    // Accept either shape so both work.
    let row;
    if (email) {
      ({ rows: [row] } = await pool.query(
        `SELECT * FROM otp_codes WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW() ORDER BY id DESC LIMIT 1`,
        [String(email).trim().toLowerCase(), String(code).trim()]
      ));
    } else {
      ({ rows: [row] } = await pool.query(
        `SELECT * FROM otp_codes WHERE code = $1 AND used = FALSE AND expires_at > NOW() ORDER BY id DESC LIMIT 1`,
        [String(code).trim()]
      ));
    }
    if (!row) return res.status(400).json({ message: 'Invalid or expired code' });

    await pool.query('UPDATE otp_codes SET used = TRUE WHERE id = $1', [row.id]);
    await pool.query('UPDATE users SET email_verified = TRUE WHERE email = $1', [row.email]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('verify-otp:', err.message);
    return res.status(500).json({ message: 'Verification failed. Please try again.' });
  }
});

// POST /api/auth/login { email, password } -> { token, user }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [
      String(email).trim().toLowerCase(),
    ]);
    const user = rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ message: 'Invalid email or password' });
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Invalid email or password' });

    const pub = publicUser(user);
    return res.json({ token: signToken(pub), user: pub });
  } catch (err) {
    console.error('login:', err.message);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// POST /api/auth/google { idToken } (or { code } legacy) -> { token, user }
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken || String(idToken).split('.').length !== 3) {
      return res.status(400).json({ message: 'A Google ID token is required' });
    }
    const check = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!check.ok) return res.status(401).json({ message: 'Google sign-in failed. Please try again.' });
    const info = await check.json();
    const expected = process.env.GOOGLE_CLIENT_ID;
    if (expected && info.aud !== expected) {
      return res.status(401).json({ message: 'Google sign-in failed. Please try again.' });
    }
    if (!info.email) return res.status(401).json({ message: 'Google sign-in failed. Please try again.' });

    const cleanEmail = String(info.email).trim().toLowerCase();
    let { rows } = await pool.query('SELECT * FROM users WHERE google_sub = $1 OR email = $2', [
      info.sub,
      cleanEmail,
    ]);
    let user = rows[0];
    if (!user) {
      ({ rows } = await pool.query(
        `INSERT INTO users (email, name, avatar, role, google_sub, email_verified)
         VALUES ($1, $2, $3, 'Landlord', $4, TRUE) RETURNING *`,
        [cleanEmail, info.name || cleanEmail.split('@')[0], info.picture || '', info.sub]
      ));
      user = rows[0];
    } else if (!user.google_sub) {
      await pool.query('UPDATE users SET google_sub = $1, email_verified = TRUE WHERE id = $2', [
        info.sub,
        user.id,
      ]);
    }
    const pub = publicUser(user);
    return res.json({ token: signToken(pub), user: pub });
  } catch (err) {
    console.error('google:', err.message);
    return res.status(500).json({ message: 'Google sign-in failed. Please try again.' });
  }
});

module.exports = router;
