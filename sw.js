/* AIM service worker: shows push notifications (vibrate + banner) and focuses the app when one is tapped.
   style "code"    -> big banner picture (programming tasks)
   style "general" -> dark card look with "open" and "reply" buttons (everything else) */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (list.some((c) => c.visibilityState === "visible" && c.focused)) return;   // already looking at the app
    const o = {
      body: d.body || "", tag: "aim-" + (d.conv || "x"), renotify: true,
      icon: "icon-192.png?v=3", badge: "favicon-32.png?v=3", vibrate: [250, 120, 250],
    };
    if (d.style === "code") o.image = "notif-code.png";
    else o.actions = [{ action: "open", title: "פתח" }, { action: "reply", title: "השב" }];
    await self.registration.showNotification(d.title || "AIM", o);
  })());
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const reply = e.action === "reply";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) { if (reply) c.postMessage({ type: "reply" }); return c.focus(); }
    return self.clients.openWindow(reply ? "./#reply" : "./");
  }));
});
