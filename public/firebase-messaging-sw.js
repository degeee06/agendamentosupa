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

// Listener padrão do Firebase
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em segundo plano ', payload);
  
  // CORREÇÃO DE DUPLICIDADE:
  // Se o payload já tem "notification", o navegador exibe automaticamente.
  // Não devemos chamar showNotification novamente.
  if (payload.notification) {
      console.log("Notificação gerenciada pelo sistema (payload contém chave 'notification').");
      return; 
  }

  // Apenas exibe manualmente se for uma mensagem somente de dados (Data-only)
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

// Listener para clique na notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // Tenta recuperar dados da URL de destino (se houver) ou abre a raiz
  const targetUrl = event.notification.data?.landing_page || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Se houver uma janela aberta do app, foca nela
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
