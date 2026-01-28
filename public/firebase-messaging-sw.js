
// Importa o SDK do Firebase versão compat para o Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configurações idênticas ao frontend
firebase.initializeApp({
  apiKey: "AIzaSyAY16KjixfTRn9lxHuGF2B0-v5nAeOJSlI",
  authDomain: "agendamento-link-e6f81.firebaseapp.com",
  projectId: "agendamento-link-e6f81",
  storageBucket: "agendamento-link-e6f81.firebasestorage.app",
  messagingSenderId: "881996925647",
  appId: "1:881996925647:web:d97b219007ce760b2485ba"
});

const messaging = firebase.messaging();

// Handler para mensagens recebidas com o navegador fechado ou aba em background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);
  
  const notificationTitle = payload.notification.title || "Novo Agendamento";
  const notificationOptions = {
    body: payload.notification.body || "Você tem uma nova atualização no Oubook.",
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
