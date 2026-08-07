// Listener untuk menangkap Push Notification dari Vercel Server saat Aplikasi/Browser Mati Total
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

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/badge.png',
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: true,
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Buka Aplikasi 🚀' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handling ketika notifikasi diklik di HP karyawan
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
