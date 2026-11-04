const VERSION = 'coloring-day-v1';
const SHELL = `${VERSION}-shell`, DATA = `${VERSION}-data`;
const assets = ['/', '/app.js', '/style.css', '/pwa.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(assets)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('coloring-day-') && ![SHELL, DATA].includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const isData = url.pathname === '/api/templates' || url.pathname.startsWith('/img/');
  if (!isData && !assets.includes(url.pathname)) return;
  // Network first keeps season lists and edited code current. Only successful responses are saved.
  event.respondWith((async () => {
    const cache = await caches.open(isData ? DATA : SHELL);
    try {
      const response = await fetch(request);
      if (response.ok) {
        try {
          await cache.put(request, response.clone());
          if (isData) { const keys = await cache.keys(); for (const key of keys.slice(0, Math.max(0, keys.length - 60))) await cache.delete(key); }
        } catch { /* A full device cache must not prevent online use. */ }
      }
      return response;
    } catch {
      const saved = await cache.match(request);
      if (saved) return saved;
      return new Response('이 도안은 오프라인에서 사용할 수 없어요. 인터넷 연결 후 다시 시도해주세요.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
