const express = require('express');
const cloudinary = require('cloudinary').v2;
const { requireAuth } = require('../auth');

const router = express.Router();

// POST /api/uploads/sign -> short-lived signed params so the app uploads
// photos straight to Cloudinary without proxying megabytes through this
// server. The listing create/update endpoints still accept data-URLs for
// older app builds.
router.post('/sign', requireAuth, (req, res) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ message: 'Photo upload is not configured' });
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'aqaree';
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, apiSecret);
    return res.json({ cloudName, apiKey, timestamp, signature, folder });
  } catch (err) {
    console.error('uploads/sign:', err.message);
    return res.status(500).json({ message: 'Could not prepare upload' });
  }
});

module.exports = router;
