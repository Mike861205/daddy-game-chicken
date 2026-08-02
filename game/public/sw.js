const WORKER_VERSION =
  new URL(self.location.href).searchParams.get('v') || 'fallback';
const CACHE_NAME = `daddy-pollo-pwa-${WORKER_VERSION}`;
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/assets/icons/daddy-pollo-pwa-192.png',
  '/assets/icons/daddy-pollo-pwa-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/superadmin/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached ?? network;
    }),
  );
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'daddy-pollo-play-reminder') {
    return;
  }

  event.waitUntil(
    self.registration.showNotification('Daddy Pollo te espera', {
      body: '¡Vuelve a jugar y supera tu mejor puntuación!',
      icon: '/assets/icons/daddy-pollo-pwa-192.png',
      badge: '/assets/icons/daddy-pollo-pwa-192.png',
      tag: 'daddy-pollo-play-reminder',
    }),
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'Daddy Pollo';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || 'Tenemos novedades para ti.',
      icon: '/assets/icons/daddy-pollo-pwa-192.png',
      badge: '/assets/icons/daddy-pollo-pwa-192.png',
      tag: payload.tag || 'daddy-pollo-message',
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath =
    typeof event.notification.data?.url === 'string' &&
    event.notification.data.url.startsWith('/') &&
    !event.notification.data.url.startsWith('//')
      ? event.notification.data.url
      : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existingClient) {
        return existingClient.navigate(targetPath).then(() => existingClient.focus());
      }
      return self.clients.openWindow(targetPath);
    }),
  );
});
