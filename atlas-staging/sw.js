/* Atlas service worker: the app shell offline (network first for pages, stale-while-revalidate for css/js/fonts),
   and notifications that always show something (iOS drops subscriptions after silent pushes). */
const CACHE = "atlas-20261030.1657";
const SHELL = ["./", "index.html", "css/app.css?v=20261030.1657", "js/app.js?v=20261030.1657", "js/live.js?v=20261030.1657", "js/theater.js?v=20261030.1657",
  "js/highlight.js?v=20261030.1657", "js/orb.js?v=20261030.1657", "worklets/mic.js", "worklets/player.js", "icons/icon-192.png", "manifest.webmanifest"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || /supabase\.co|googleapis\.com\/(v1|ws)|generativelanguage/.test(u.host + u.pathname)) return;
  if (u.origin === location.origin && !u.pathname.includes("/atlas")) return;   // other pages of the site (AIM, built sites)
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put("index.html", c)); return r; })
      .catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => {
    const net = fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || "Atlas", { body: d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: d.tag || "atlas", data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data || {}).url || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.includes("/atlas") && "focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
