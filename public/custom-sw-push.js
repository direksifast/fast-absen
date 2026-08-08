// Listener untuk menangkap Push Notification dari Server Vercel saat Aplikasi/Browser Ditutup Total
self.addEventListener('push', function (event) {
  let data = {
    title: '⏰ Peringatan FAST ABSEN',
    body: 'Jangan lupa untuk melakukan absensi!',
    url: '/'
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const title = data.title || '⏰ FAST ABSEN';
  const options = {
    body: data.body || 'Jangan lupa lakukan absensi tepat waktu!',
    icon: '/pwa-192x192.png',
    badge: '/badge.png',
    vibrate: [500, 200, 500, 200, 500],
    tag: 'fast-absen-push-notification',
    renotify: true,
    requireInteraction: true,
    silent: false,
    timestamp: Date.now(),
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Buka Aplikasi Absensi 🚀' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handling ketika notifikasi diklik di Notification Bar HP
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
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

