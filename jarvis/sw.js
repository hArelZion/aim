/* Pocket Jarvis's service worker (scope /aim/jarvis/): notifications outside the app — a finished site, a late answer,
   a cloud build — and a tap opens the link (or the app). Sent by the PC (push.py, row "jarvis_push") or by the cloud
   brain (the `jarvis` function) with the same VAPID key as the AIM chat. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = wins.some((w) => w.visibilityState === "visible");
    if (open && !d.url) { wins.forEach((w) => w.postMessage({ t: "push", d })); return; }   // on screen: the app shows it
    await self.registration.showNotification(d.title || "JARVIS", {
      body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.tag || "jarvis-" + Date.now(),
      data: { url: d.url || "" }, vibrate: [60, 40, 60],
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data || {}).url;
  e.waitUntil((async () => {
    if (url) return self.clients.openWindow(url);
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.length) return wins[0].focus();
    return self.clients.openWindow("./");
  })());
});
