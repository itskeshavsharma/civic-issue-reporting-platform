const { admin, messaging } = require('../config/firebase');
const Notification = require('../models/Notification');

/**
 * Send Multicast FCM Web Push Notification and concurrently persist in-app Notification records.
 *
 * @param {Object} params
 * @param {string[]} params.tokens - Array of device FCM tokens
 * @param {string[]} [params.userIds] - Array of user UIDs who reported or are linked to the complaint
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body / message
 * @param {string|mongoose.Types.ObjectId} [params.complaintId] - Associated Complaint ID
 * @param {string} [params.clickAction] - Target frontend URL when notification is clicked
 * @returns {Promise<{fcmSuccessCount: number, fcmFailureCount: number, inAppCreatedCount: number}>}
 */
const sendComplaintNotification = async ({
  tokens = [],
  userIds = [],
  title,
  body,
  complaintId = null,
  clickAction = '/my-complaints',
}) => {
  const result = {
    fcmSuccessCount: 0,
    fcmFailureCount: 0,
    inAppCreatedCount: 0,
  };

  // 1. Create In-App Notification records in MongoDB for all relevant users
  try {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueUserIds.length > 0) {
      const notificationDocs = uniqueUserIds.map((uid) => ({
        userId: uid,
        title,
        message: body,
        complaintId: complaintId || null,
        read: false,
        createdAt: new Date(),
      }));

      const inserted = await Notification.insertMany(notificationDocs);
      result.inAppCreatedCount = inserted.length;
      console.log(`[Notification Service] Created ${inserted.length} in-app notification records.`);
    }
  } catch (dbErr) {
    console.error('[Notification Service] Error creating in-app notifications:', dbErr);
  }

  // 2. Dispatch FCM Multicast Web Push Notification
  try {
    // Filter out invalid/empty tokens and deduplicate
    const validTokens = Array.from(new Set(tokens.filter((t) => t && typeof t === 'string' && t.trim() !== '')));

    if (validTokens.length === 0) {
      console.log('[Notification Service] No valid FCM tokens provided for push notification.');
      return result;
    }

    if (!messaging) {
      console.warn('[Notification Service] Firebase Messaging is uninitialized. Skipping Web Push.');
      return result;
    }

    const payload = {
      tokens: validTokens,
      notification: {
        title,
        body,
      },
      data: {
        complaintId: complaintId ? String(complaintId) : '',
        url: clickAction,
        click_action: clickAction,
      },
      webpush: {
        notification: {
          title,
          body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
        },
        fcmOptions: {
          link: clickAction,
        },
      },
    };

    const response = await messaging.sendEachForMulticast(payload);
    result.fcmSuccessCount = response.successCount;
    result.fcmFailureCount = response.failureCount;

    console.log(
      `[Notification Service] FCM Multicast complete. Success: ${response.successCount}, Failed: ${response.failureCount}`
    );

    // Clean up failed / invalid tokens if needed
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.warn(`[Notification Service] FCM send failure for token [${validTokens[idx]}]:`, resp.error?.message);
        }
      });
    }
  } catch (fcmErr) {
    console.error('[Notification Service] FCM Multicast dispatch error:', fcmErr);
  }

  return result;
};

module.exports = {
  sendComplaintNotification,
};
