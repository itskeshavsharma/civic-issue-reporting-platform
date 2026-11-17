const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a memory buffer (e.g. from Multer) directly to Cloudinary.
 *
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {string} folderName - Target folder inside Cloudinary (e.g. 'civic_reports', 'civic_in_progress', 'civic_resolutions')
 * @param {Object} [customOptions] - Optional additional Cloudinary upload options
 * @returns {Promise<string>} Resolves to Cloudinary secure HTTPS URL
 */
const uploadImageToCloudinary = (fileBuffer, folderName = 'civic_reports', customOptions = {}) => {
  return new Promise((resolve, reject) => {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      return reject(new Error('Invalid file buffer provided for Cloudinary upload.'));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto',
        ...customOptions,
      },
      (error, result) => {
        if (error) {
          console.error(`[Cloudinary Upload Error - ${folderName}]:`, error);
          return reject(error);
        }
        if (!result || !result.secure_url) {
          return reject(new Error('Cloudinary upload response missing secure_url.'));
        }
        resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

module.exports = {
  cloudinary,
  uploadImageToCloudinary,
};
