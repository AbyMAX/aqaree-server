// Firebase Cloud Messaging sender. Credentials come from the
// FIREBASE_SERVICE_ACCOUNT env var (JSON pasted in Render, never in code).
// Everything fails soft: pushes are best-effort, never break the API.
const pool = require('./db/pool');

let admin = null;
let warned = false;

function fcm() {
  if (admin) return admin;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) return null;
    const creds = JSON.parse(raw);
    // eslint-disable-next-line global-require
    admin = require('firebase-admin');
    admin.initializeApp({ credential: admin.credential.cert(creds) });
    return admin;
  } catch (err) {
    if (!warned) {
      warned = true;
      console.error('[fcm] disabled:', err.message);
    }
    return null;
  }
}

// Push a notification + data payload to all of a user's devices.
async function pushToUser(userId, { title, body, data }) {
  try {
    const a = fcm();
    if (!a || !userId) return;
    const { rows } = await pool.query('SELECT token FROM user_devices WHERE user_id = $1', [userId]);
    const tokens = rows.map((r) => r.token).filter(Boolean);
    if (!tokens.length) return;
    const strData = {};
    Object.entries(data || {}).forEach(([k, v]) => {
      strData[k] = String(v);
    });
    await a.messaging().sendEachForMulticast({
      tokens,
      notification: { title: String(title || ''), body: String(body || '') },
      data: strData,
    });
  } catch (err) {
    console.error('push:', err.message);
  }
}

module.exports = { pushToUser };
