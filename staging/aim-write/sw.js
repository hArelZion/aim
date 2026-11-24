// AIM Write service worker: offline shell + Android share target.
const V = 'aimwrite-v2';
const SHELL = ['./', 'index.html', 'app.css?v=2', 'app.js?v=2', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'ktov-share').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const file = form.get('file');
        if (file) {
          const c = await caches.open('ktov-share');
          await c.put('shared-file', new Response(file, { headers: { 'content-type': file.type, 'x-name': encodeURIComponent(file.name || 'shared') } }));
        }
      } catch (err) {}
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const heavy = /\/(vendor|models|icons)\//.test(url.pathname);
  if (heavy) {
    // big, versioned files: cache first
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(e.request, cp)); }
      return res;
    })));
  } else {
    // app shell: network first so updates arrive at once, cache when offline
    e.respondWith(fetch(e.request).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(e.request, cp)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
  }
});
