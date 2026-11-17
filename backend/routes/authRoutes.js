const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { getMe } = require('../controllers/authController');

/**
 * @route   GET /api/auth/me
 * @desc    Get decoded Firebase user identity, role, assignedArea & permissions
 * @access  Private (Firebase Token)
 */
router.get('/me', verifyToken, getMe);

module.exports = router;
