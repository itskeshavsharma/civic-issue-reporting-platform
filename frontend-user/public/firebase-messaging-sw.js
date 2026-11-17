// Firebase Cloud Messaging Background Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Initialize Firebase inside the Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyCqF2Cy6sVvZulwvyEd6YlAffcftL9o31c",
  authDomain: "civic-841fe.firebaseapp.com",
  projectId: "civic-841fe",
  storageBucket: "civic-841fe.firebasestorage.app",
  messagingSenderId: "702057882049",
  appId: "1:702057882049:web:b60f26b55bc6bebf1acf40",
});

const messaging = firebase.messaging();

// Handle incoming push messages when the web app is closed or in background
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Civic Ticket Update';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'There is an update on your reported civic complaint.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: {
      url: payload.data?.url || payload.data?.click_action || '/my-complaints',
      complaintId: payload.data?.complaintId || null,
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click to focus or open window to /my-complaints
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/my-complaints';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
