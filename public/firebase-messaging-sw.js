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

// Nome do Cache para controle de versão
const CACHE_NAME = 'oubook-pwa-v1';
// Arquivos essenciais para o "Shell" do app funcionar offline
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.css',
  '/manifest.json',
  '/icon.svg'
];

// Instalação: Cache dos arquivos estáticos essenciais
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Tenta cachear, mas não falha a instalação se um arquivo opcional falhar
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.warn('Falha parcial no cache:', err));
    })
  );
});

// Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Fetch: Estratégia Network First (Tenta rede, se falhar, usa cache)
// Isso é CRUCIAL para o banner de instalação aparecer
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não sejam GET ou que sejam para esquemas não suportados (ex: chrome-extension)
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Para navegação (HTML), tenta rede -> cache -> fallback offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/index.html')
            .then(response => response || caches.match('/'));
        })
    );
    return;
  }

  // Para outros recursos, tenta rede -> cache
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

// Listener padrão do Firebase para mensagens em background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em segundo plano ', payload);
  
  if (payload.notification) {
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