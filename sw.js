
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || "Você tem uma nova atualização no Oubook!",
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
      console.error("Erro ao processar dados do push:", e);
      // Fallback para texto simples se o JSON falhar
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification("Oubook", {
          body: text,
          icon: "/icon.svg"
        })
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
