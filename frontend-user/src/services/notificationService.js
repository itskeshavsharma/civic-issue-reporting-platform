import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from '../config/firebase';
import { apiClient } from './api';

let messagingInstance = null;

/**
 * Safely initialize Firebase Messaging instance
 */
export const getFirebaseMessaging = async () => {
  if (messagingInstance) return messagingInstance;

  try {
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    } else {
      console.warn('[FCM] Firebase messaging is not supported in this browser environment.');
      return null;
    }
  } catch (err) {
    console.warn('[FCM] Initialization error:', err.message);
    return null;
  }
};

/**
 * Request notification permission, register service worker, and acquire FCM device token.
 * Stores token in localStorage under 'fcmToken'.
 *
 * @returns {Promise<string|null>} FCM Device Registration Token
 */
export const requestNotificationPermission = async () => {
  try {
    if (!('Notification' in window)) {
      console.warn('[FCM] This browser does not support desktop push notifications.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Notification permission was denied or dismissed.');
      return null;
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    // Register service worker explicitly for push reception
    let serviceWorkerRegistration = null;
    if ('serviceWorker' in navigator) {
      try {
        serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } catch (swErr) {
        console.warn('[FCM] Service worker registration warning:', swErr);
      }
    }

    const vapidKey =
      import.meta.env.VITE_FIREBASE_VAPID_KEY ||
      'BDdBVjs6OHdBjjq6_-znqoVhG1x7NJMaG3B9j-Luv9KVAbO81XpNsVxGvOBJB7fCHbPW9Pr45uuNkNJEMAggIRU';

    const currentToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: serviceWorkerRegistration || undefined,
    });

    if (currentToken) {
      localStorage.setItem('fcmToken', currentToken);
      console.log('[FCM] Push Token generated and cached:', currentToken.substring(0, 15) + '...');
      return currentToken;
    } else {
      console.warn('[FCM] No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (error) {
    console.error('[FCM Error] An error occurred while retrieving token:', error);
    return localStorage.getItem('fcmToken') || null;
  }
};

/**
 * Listen for incoming foreground messages and trigger an optional callback / custom event.
 *
 * @param {Function} callback - Triggered when a new foreground message arrives
 * @returns {Function} Unsubscribe listener function
 */
export const onMessageListener = (callback) => {
  let unsubscribe = () => {};

  getFirebaseMessaging().then((messaging) => {
    if (messaging) {
      unsubscribe = onMessage(messaging, (payload) => {
        console.log('[FCM Foreground Message]:', payload);
        if (callback && typeof callback === 'function') {
          callback(payload);
        }
        // Dispatch custom DOM event for components like Navbar to catch live updates
        window.dispatchEvent(
          new CustomEvent('civic:notification_received', { detail: payload })
        );
      });
    }
  });

  return () => unsubscribe();
};

/**
 * Retrieve cached FCM device token from localStorage
 */
export const getCachedFcmToken = () => {
  return localStorage.getItem('fcmToken') || '';
};

// ─── In-App Notifications API Endpoints ──────────────────────────────────────

/**
 * Fetch list of in-app notifications for authenticated user
 */
export const fetchUserNotifications = async () => {
  const response = await apiClient.get('/notifications');
  return response.data;
};

/**
 * Mark a single notification as read
 */
export const markNotificationAsRead = async (notificationId) => {
  const response = await apiClient.patch(`/notifications/${notificationId}/read`);
  return response.data;
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async () => {
  const response = await apiClient.patch('/notifications/read-all');
  return response.data;
};

/**
 * Clear/delete all notifications for authenticated user
 */
export const clearAllNotifications = async () => {
  const response = await apiClient.delete('/notifications/clear-all');
  return response.data;
};
