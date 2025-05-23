// Firebase messaging service worker
// This file is specifically for Firebase Cloud Messaging and works alongside the main PWA service worker

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// This configuration should match your client-side Firebase config
const firebaseConfig = {
  // These will be populated from your environment variables
  // The actual values are loaded from the client
};

// Only initialize if we have a valid config
if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      console.log('Received background message: ', payload);

      const notificationTitle = payload.notification?.title || 'Hasyx Notification';
      const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: '/icons/icon-192.webp',
        badge: '/icons/icon-96.webp',
        data: payload.data || {},
        actions: [
          {
            action: 'open',
            title: 'Open App'
          },
          {
            action: 'close',
            title: 'Close'
          }
        ],
        requireInteraction: false,
        tag: payload.data?.tag || 'default',
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });

    // Handle notification clicks (this complements the main service worker)
    self.addEventListener('notificationclick', (event) => {
      console.log('Firebase notification clicked:', event);
      
      event.notification.close();
      
      if (event.action === 'close') {
        return;
      }
      
      const url = event.notification.data?.url || '/';
      
      event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clients) => {
          for (const client of clients) {
            if (client.url === url && 'focus' in client) {
              return client.focus();
            }
          }
          
          if (clients.openWindow) {
            return clients.openWindow(url);
          }
        })
      );
    });

  } catch (error) {
    console.error('Firebase initialization failed:', error);
  }
} else {
  console.log('Firebase not available in service worker');
}

console.log('Firebase messaging service worker loaded'); 