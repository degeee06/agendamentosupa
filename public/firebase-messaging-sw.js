importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// Dados extraídos do seu JSON
firebase.initializeApp({
  apiKey: "AIzaSyAZZdxquZYwS7M7-FL3R_gwqA30Q-bCvwc",
  authDomain: "agendamento-link-e6f81.firebaseapp.com",
  projectId: "agendamento-link-e6f81",
  storageBucket: "agendamento-link-e6f81.firebasestorage.app",
  messagingSenderId: "881996925647",
  appId: "1:881996925647:web:96e83812836269b62485ba"
});

const messaging = firebase.messaging();

// Força o SW a ativar imediatamente
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// --- REQUISITO PWA: Handler de Fetch ---
// Para que o navegador mostre o botão de instalar, o SW precisa interceptar requisições.
self.addEventListener('fetch', (event) => {
  // Apenas passa a requisição adiante (Network Only), mas satisfaz o critério de PWA.
  // Você pode adicionar lógica de cache aqui no futuro se quiser funcionamento offline.
  event.respondWith(fetch(event.request));
});

// Listener padrão do Firebase
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em segundo plano ', payload);
  
  if (payload.notification) {
      console.log("Notificação gerenciada pelo sistema (payload contém chave 'notification').");
      return; 
  }

  const notificationTitle = payload.data?.title;
  const notificationBody = payload.data?.body;
  const notificationIcon = '/icon.svg';

  if (notificationTitle) {
      const notificationOptions = {
        body: notificationBody,
        icon: notificationIcon,
        badge: '/icon.svg',
        renotify: true,
        tag: 'oubook-notification',
        requireInteraction: true,
        data: payload.data
      };
    
      self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const targetUrl = event.notification.data?.landing_page || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});