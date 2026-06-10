// Service worker — network-first com fallback em cache.
// Mantém o app shell disponível offline; dados do Supabase nunca são cacheados aqui
// (o snapshot offline fica no localStorage, gerenciado pelo main.js).
const CACHE = 'vf-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  const isOwn = url.origin === location.origin;
  const isCdn = /fonts\.(googleapis|gstatic)\.com$|cdnjs\.cloudflare\.com$/.test(url.hostname);
  if (!isOwn && !isCdn) return; // Supabase e afins: sempre rede

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(m =>
          m || (e.request.mode === 'navigate' ? caches.match('/') : Response.error())
        )
      )
  );
});
