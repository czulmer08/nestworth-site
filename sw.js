/* NestWorth service worker — makes the app work offline and caches Wren's images.
   Bump CACHE (…-vN) whenever you replace an image file so the new art is picked up. */
const CACHE = 'nestworth-assets-v12';
const PRECACHE = [
  'app.html', 'apple-touch-icon.png',
  'wren/happy.png','wren/glasses.png','wren/study.png','wren/cheer.png','wren/confused.png','wren/search.png',
  'wren/full.png','wren/nest.png','wren/goal.png','wren/insights.png',
  'wren/privacy.png','wren/growing.png','wren/guiding.png','wren/goalreached.png','wren/nestegg.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(()=>{})).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;               // never touch Google APIs / auth (cross-origin)

  // The app HTML: network-first, so fresh loads + the in-app update check always win online; cache is the offline fallback.
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
                .catch(() => caches.match(req).then(m => m || caches.match('app.html')))
    );
    return;
  }

  // Wren images, fonts, icons: stale-while-revalidate — instant from cache, quietly refreshed in the background.
  if (/\.(png|woff2|ico|svg)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }
});
