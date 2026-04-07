// service-worker.js
// GHOST-HUB v3.1 - Service Worker для offline-работы и push-уведомлений

const CACHE_NAME = 'ghost-hub-v3.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Динамический кэш для данных
const DATA_CACHE = 'ghost-hub-data-v3.1';

// Установка - кэшируем статику
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      // Skip waiting - сразу активируем новый SW
      return self.skipWaiting();
    })
  );
});

// Активация - чистим старые кэши
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== DATA_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Берём контроль над всеми клиентами
      return self.clients.claim();
    })
  );
});

// Fetch - стратегия: сеть с fallback на кэш
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API запросы (Supabase, Nominatim) - сеть первой, потом кэш
  if (url.pathname.includes('/rest/') || 
      url.hostname.includes('supabase') ||
      url.hostname.includes('nominatim')) {
    
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Кэшируем успешные ответы
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(DATA_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback на кэш при offline
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // Если нет в кэше - возвращаем offline JSON
            return new Response(
              JSON.stringify({ offline: true, error: 'Нет соединения' }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Статика - кэш первым, потом сеть
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Фоновое обновление
        fetch(request).then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response);
            });
          }
        }).catch(() => {});
        return cached;
      }

      // Нет в кэше - идём в сеть
      return fetch(request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback для HTML
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Background Sync - отложенная отправка данных
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
  if (event.tag === 'sync-logs') {
    event.waitUntil(syncLogs());
  }
});

async function syncMessages() {
  // Отправка отложенных сообщений из IndexedDB
  const db = await openDB('ghost-hub-db', 1);
  const messages = await db.getAll('pending-messages');
  
  for (const msg of messages) {
    try {
      // Отправка через fetch или BroadcastChannel
      await fetch('/api/send-message', {
        method: 'POST',
        body: JSON.stringify(msg)
      });
      await db.delete('pending-messages', msg.id);
    } catch (err) {
      console.error('[SW] Failed to sync message:', err);
    }
  }
}

async function syncLogs() {
  // Аналогично для логов
}

// Push Notifications - уведомления от сервера или P2P
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'Новое уведомление',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    data: data.payload || {}
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'GHOST-HUB',
      options
    )
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const { notification } = event;
  const payload = notification.data || {};
  
  // Определяем куда перейти
  let url = '/';
  if (payload.type === 'chat') url = '/?action=chat';
  if (payload.type === 'safety') url = '/?action=safety';
  if (payload.type === 'equipment') url = '/?action=equipment';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Если есть открытое окно - фокусируем
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Иначе открываем новое
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Сообщения от основного приложения
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, payload } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      data: payload,
      tag: payload?.type || 'general'
    });
  }
});

// Вспомогательная функция для IndexedDB
function openDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-messages')) {
        db.createObjectStore('pending-messages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pending-logs')) {
        db.createObjectStore('pending-logs', { keyPath: 'id' });
      }
    };
  });
}

// Периодическая синхронизация (если поддерживается)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-sync') {
    event.waitUntil(periodicSync());
  }
});

async function periodicSync() {
  // Обновление данных команды, проверка статуса
  console.log('[SW] Periodic sync');
}

console.log('[SW] Service Worker loaded');
