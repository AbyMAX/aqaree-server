const { rateLimit } = require('express-rate-limit');

// Per-IP throttles for the abuse-sensitive auth endpoints (brute force,
// account farming, OTP email spend). Generous enough for shared networks;
// the OTP resend endpoint additionally throttles per email address.
function authLimiter({ windowMinutes, max }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many attempts. Please wait a little and try again.', code: 'RATE_LIMITED' },
  });
}

module.exports = {
  loginLimiter: authLimiter({ windowMinutes: 15, max: 20 }),
  registerLimiter: authLimiter({ windowMinutes: 60, max: 10 }),
  verifyLimiter: authLimiter({ windowMinutes: 10, max: 20 }),
  resendLimiter: authLimiter({ windowMinutes: 10, max: 5 }),
  googleLimiter: authLimiter({ windowMinutes: 15, max: 30 }),
  // Anonymous catalog reads: generous for humans, slow for scrapers
  // walking IDs or the list endpoint. Health/assetlinks stay unlimited.
  publicLimiter: authLimiter({ windowMinutes: 15, max: 300 }),
};
