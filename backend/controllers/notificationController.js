const Notification = require('../models/Notification');

/**
 * GET /api/notifications
 * Fetch all notifications for the authenticated user sorted by createdAt descending.
 */
const getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ userId, read: false });

    return res.status(200).json({
      success: true,
      unreadCount,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
const markNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access unauthorized.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications for the authenticated user as read.
 */
const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const userId = req.user.uid;

    const result = await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true } }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/notifications/clear-all
 * Clear/delete all notifications for the authenticated user.
 */
const clearAllNotifications = async (req, res, next) => {
  try {
    const userId = req.user.uid;

    const result = await Notification.deleteMany({ userId });

    return res.status(200).json({
      success: true,
      message: 'All notifications cleared successfully.',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications,
};
