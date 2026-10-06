/* AIM service worker: shows push notifications (vibrate + banner) and focuses the app when one is tapped. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (list.some((c) => c.visibilityState === "visible" && c.focused)) return;   // already looking at the app
    await self.registration.showNotification(d.title || "AIM", {
      body: d.body || "", tag: "aim-" + (d.conv || "x"), renotify: true,
      icon: "icon-192.png", badge: "favicon-32.png", vibrate: [250, 120, 250],
    });
  })());
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
