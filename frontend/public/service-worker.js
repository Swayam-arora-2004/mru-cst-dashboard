/*
 * 📡 MRU CST Dashboard Service Worker
 * Handles background push notifications and interaction events.
 */

self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const payload = event.data.json();
      const options = {
        body: payload.body,
        icon: payload.icon || '/logo.png',
        badge: '/badge.png',
        data: payload.data || { url: '/' },
        vibrate: [100, 50, 100],
        actions: [
          { action: 'open', title: 'Open Dashboard' }
        ]
      };

      event.waitUntil(
        self.registration.showNotification(payload.title, options)
      );
    } catch (e) {
      console.error('Push payload parse error:', e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
