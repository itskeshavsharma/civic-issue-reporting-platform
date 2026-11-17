const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { updateProfile, getProfile } = require('../controllers/userController');

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private (All 5 roles)
 */
router.get('/profile', verifyToken, getProfile);

/**
 * @route   PATCH /api/users/profile
 * @desc    Update user profile (name, phone, avatar, isOnLeave)
 * @access  Private (All 5 roles)
 */
router.patch(
  '/profile',
  verifyToken,
  (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      return upload.single('avatar')(req, res, (err) => {
        if (err) {
          return res.status(400).json({ success: false, message: err.message || 'Image upload error' });
        }
        next();
      });
    }
    next();
  },
  updateProfile
);

module.exports = router;
