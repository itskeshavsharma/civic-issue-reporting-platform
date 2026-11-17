const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications,
} = require('../controllers/notificationController');

/**
 * @route   GET /api/notifications
 * @desc    Get current user's in-app notifications
 * @access  Private (Firebase Auth)
 */
router.get('/', authMiddleware, getUserNotifications);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private (Firebase Auth)
 */
router.patch('/read-all', authMiddleware, markAllNotificationsAsRead);

/**
 * @route   DELETE /api/notifications/clear-all
 * @desc    Clear all notifications for user
 * @access  Private (Firebase Auth)
 */
router.delete('/clear-all', authMiddleware, clearAllNotifications);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark single notification as read
 * @access  Private (Firebase Auth)
 */
router.patch('/:id/read', authMiddleware, markNotificationAsRead);

module.exports = router;
