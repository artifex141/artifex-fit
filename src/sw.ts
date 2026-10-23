/// <reference lib="webworker" />
// Service worker: офлайн-кэш приложения + push-уведомления о конце отдыха.
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; tag?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Отдых окончен', {
      body: data.body ?? 'Пора делать следующий подход',
      tag: data.tag ?? 'rest',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      // renotify: повторный звук, даже если прошлое уведомление ещё висит
      ...({ renotify: true } as NotificationOptions),
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = all.find((c) => c.url.startsWith(self.registration.scope));
      if (existing) return existing.focus();
      return self.clients.openWindow(self.registration.scope);
    })(),
  );
});
