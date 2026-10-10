// Firebase Cloud Messaging sender. Credentials come from the
// FIREBASE_SERVICE_ACCOUNT env var (JSON pasted in Render, never in code).
// Everything fails soft: pushes are best-effort, never break the API.
const pool = require('./db/pool');

let fcmHandle = null;
let warned = false;

function fcm() {
  const st = initFcm();
  return st.handle;
}

// Shared init with per-step diagnostics (safe to expose: no secrets).
// firebase-admin v12+ is modular: initializeApp/cert live on the main
// entry while messaging comes from the 'firebase-admin/messaging'
// subpath — neither lives under a `.credential` namespace anymore.
function initFcm() {
  if (fcmHandle) return { handle: fcmHandle, steps: { cached: true } };
  const steps = {};
  try {
    let sdk;
    try {
      // eslint-disable-next-line global-require
      sdk = require('firebase-admin');
      steps.sdkLoad = 'ok';
    } catch (e) {
      steps.sdkLoad = String((e && e.message) || e).slice(0, 160);
      return { handle: null, steps };
    }
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      steps.key = 'missing';
      return { handle: null, steps };
    }
    let creds;
    try {
      creds = JSON.parse(raw);
      steps.parse = 'ok';
    } catch (e) {
      steps.parse = String((e && e.message) || e).slice(0, 160);
      return { handle: null, steps };
    }
    if (!creds.private_key || !creds.client_email) {
      steps.fields = 'missing';
      return { handle: null, steps };
    }
    try {
      const certFn = sdk.cert || (sdk.default && sdk.default.cert);
      const initFn = sdk.initializeApp || (sdk.default && sdk.default.initializeApp);
      if (!certFn || !initFn) throw new Error('firebase-admin exports unavailable');
      const app = initFn({ credential: certFn(creds) });
      // eslint-disable-next-line global-require
      const { getMessaging } = require('firebase-admin/messaging');
      fcmHandle = { messaging: getMessaging(app) };
      steps.init = 'ok';
      return { handle: fcmHandle, steps };
    } catch (e) {
      fcmHandle = null;
      steps.init = String((e && e.message) || e).slice(0, 200);
      return { handle: null, steps };
    }
  } catch (err) {
    if (!warned) {
      warned = true;
      console.error('[fcm] disabled:', err.message);
    }
    steps.fatal = String((err && err.message) || err).slice(0, 160);
    return { handle: null, steps };
  }
}

// Push a notification + data payload to all of a user's devices.
// Returns a summary (also surfaced on the admin response) so senders
// can tell a bad key apart from simply having no devices.
async function pushToUser(userId, { title, body, data }) {
  try {
    const h = fcm();
    if (!h) return { sent: 0, failed: 0, skipped: 'no-fcm-key' };
    if (!userId) return { sent: 0, failed: 0, skipped: 'no-user' };
    const { rows } = await pool.query('SELECT token FROM user_devices WHERE user_id = $1', [userId]);
    const tokens = rows.map((r) => r.token).filter(Boolean);
    if (!tokens.length) return { sent: 0, failed: 0, skipped: 'no-tokens', tokenCount: rows.length };
    const strData = {};
    Object.entries(data || {}).forEach(([k, v]) => {
      strData[k] = String(v);
    });
    const res = await h.messaging.sendEachForMulticast({
      tokens,
      notification: { title: String(title || ''), body: String(body || '') },
      data: strData,
    });
    return { sent: res.successCount || 0, failed: res.failureCount || 0 };
  } catch (err) {
    console.error('push:', err.message);
    return { sent: 0, failed: 0, error: String(err.message).slice(0, 160) };
  }
}

module.exports = { pushToUser, initFcm };
