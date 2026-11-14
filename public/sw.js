// Service worker simples: rede primeiro, cache como reserva (funciona offline depois da 1ª visita).
const CACHE = 'escola-ct-s300-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copia))
        return r
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  )
})
