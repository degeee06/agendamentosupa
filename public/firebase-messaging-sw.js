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
  
  const notificationTitle = payload.notification?.title || payload.data?.title;
  const notificationBody = payload.notification?.body || payload.data?.body;
  const notificationIcon = payload.notification?.icon || '/icon.svg';

  if (notificationTitle) {
      const notificationOptions = {
        body: notificationBody,
        icon: notificationIcon,
        badge: '/icon.svg',
        renotify: true,
        requireInteraction: true,
        data: payload.data
      };
    
      self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

// --- FALLBACK CRÍTICO PARA ANDROID/CHROME ---
// Se o Firebase falhar em acordar o SW para 'onBackgroundMessage',
// este listener nativo captura o evento push bruto e força a exibição.
self.addEventListener('push', (event) => {
    // Se o evento tem dados, tenta processar.
    // O Firebase geralmente intercepta isso antes, mas se falhar, este bloco garante a entrega.
    if (event.data) {
        try {
            const payload = event.data.json();
            // Verifica se é uma notificação do Firebase (geralmente tem 'notification' ou 'data')
            if (payload.notification || payload.data) {
                const title = payload.notification?.title || payload.data?.title || 'Nova Notificação';
                const options = {
                    body: payload.notification?.body || payload.data?.body || '',
                    icon: '/icon.svg',
                    badge: '/icon.svg',
                    data: payload.data,
                    requireInteraction: true
                };
                
                // Usa waitUntil para manter o SW vivo até a notificação ser mostrada
                event.waitUntil(
                    self.registration.showNotification(title, options)
                );
            }
        } catch (e) {
            console.log('Push event recebido, mas não foi possível parsear JSON ou já foi tratado.', e);
        }
    }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Se houver uma janela aberta, foca nela
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      // Se não, abre uma nova
      return clients.openWindow('/');
    })
  );
});