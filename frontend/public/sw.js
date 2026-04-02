self.addEventListener('push', function(event) {
  const data = event.data?.json() || {};
  const title = data.title || 'MRU CST Intelligence';
  const options = {
    body: data.body || 'New notification received.',
    icon: data.icon || '/logo.png',
    badge: '/logo.png',
    data: data.data || { url: '/dashboard' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
