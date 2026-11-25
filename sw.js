const CACHE_NAME = 'iar-workspace-v3.1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

async function getCachedShell(requestUrl) {
  const cache = await caches.open(CACHE_NAME);
  const direct = await cache.match(requestUrl);
  if (direct) return direct;
  const byIndex = await cache.match('./index.html');
  if (byIndex) return byIndex;
  return cache.match('./');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      (async () => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);
          const networkResponse = await fetch(event.request, { signal: controller.signal });
          clearTimeout(timer);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
            cache.put('./index.html', networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const cached = await getCachedShell(event.request);
          if (cached) return cached;
          return new Response(
            '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IAR — Офлайн</title><style>body{font-family:system-ui,sans-serif;background:#0f2342;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;text-align:center}button{margin-top:14px;padding:10px 18px;border:none;border-radius:10px;background:#2563eb;color:#fff;font-weight:700}</style></head><body><div><h2>IAR — Investigator\'s Automated Room</h2><p>Нет связи и не найден локальный кэш страницы.</p><button onclick="location.reload()">Повторить</button></div></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        return cached || new Response('', { status: 504 });
      }
    })()
  );
});
