// SkyFlag service worker — installed lazily on first push-permission grant.
// Handles incoming Web Push events and shows a system notification. Tapping
// the notification focuses an existing tab (or opens a new one).

self.addEventListener('install', () => {
  // Take control as soon as we're installed instead of waiting for the next
  // page load — keeps the activation flow predictable for testers.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'SkyFlag', body: 'It’s your move.', url: '/' };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/skyflag-logo.png',
      badge: '/skyflag-logo.png',
      tag: 'skyflag-turn',
      // Replace any existing notification for the same room rather than
      // stacking up — the player only needs to know it's their turn.
      renotify: true,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.endsWith(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return null;
    }),
  );
});
