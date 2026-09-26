const cloudinary = require('cloudinary').v2;

const configured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (configured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else {
  console.warn('[cloudinary] keys missing — photo upload disabled until env vars are set');
}

// Upload a multer memory buffer, resolve with the hosted URL.
function uploadBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'aqaree', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(buffer);
  });
}

module.exports = { configured, uploadBuffer };
