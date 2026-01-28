
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || "Você tem uma nova atualização!",
        icon: "/icon.svg",
        badge: "/icon.svg",
        vibrate: [100, 50, 100],
        data: {
          url: data.url || "/"
        }
      };
      event.waitUntil(
        self.registration.showNotification(data.title || "Oubook", options)
      );
    } catch (e) {
      // Se não for JSON, trata como texto puro
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification("Oubook", { body: text })
      );
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
