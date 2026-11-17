const multer = require('multer');

/**
 * Configure Multer in-memory storage.
 * Keeps uploaded files in memory as a Buffer, allowing direct forwarding
 * as multipart/form-data stream to the FastAPI AI microservice without
 * premature disk writes.
 */
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ];

  if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Only image files (JPEG, PNG, WebP) are allowed.`
      ),
      false
    );
  }
};

const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 Megabytes max limit
    files: 1, // Single image per complaint submission/preview
  },
});

module.exports = uploadMiddleware;
